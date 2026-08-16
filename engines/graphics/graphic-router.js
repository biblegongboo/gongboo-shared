/* Bible Graphic Router
 * Compatibility bridge between the existing Bible main.js and the pinned
 * TEST graphics bundle.
 */
const SUPPORTED_ENGINES = new Set(['jsxgraph', 'three3d', 'table', 'chart']);
const modulePromises = Object.create(null);
let jsxScriptPromise = null;
let jsxStylePromise = null;

function engineOf(payload) {
  return String(payload && payload.engine || '').trim().toLowerCase();
}

function assetUrl(fileName) {
  const url = new URL(fileName, import.meta.url);
  url.searchParams.set('v', '8.38-family-roles1');
  return url.href;
}

function loadStyleOnce() {
  if (jsxStylePromise) return jsxStylePromise;
  jsxStylePromise = new Promise(function(resolve) {
    const existing = document.querySelector('link[data-gongboo-graphic="jsxgraph"]');
    if (existing) {
      if (existing.sheet) resolve();
      else {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', resolve, { once: true });
      }
      return;
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = assetUrl('jsxgraph-1.12.2.css');
    link.dataset.gongbooGraphic = 'jsxgraph';
    link.onload = resolve;
    link.onerror = resolve;
    document.head.appendChild(link);
  });
  return jsxStylePromise;
}

function loadScriptOnce() {
  if (window.JXG && window.JXG.JSXGraph) return Promise.resolve();
  if (jsxScriptPromise) return jsxScriptPromise;
  jsxScriptPromise = new Promise(function(resolve, reject) {
    const existing = document.querySelector('script[data-gongboo-graphic="jsxgraph"]');
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', function() {
        reject(new Error('The 2D graphic library could not be loaded.'));
      }, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = assetUrl('jsxgraphcore-1.12.2.js');
    script.async = true;
    script.dataset.gongbooGraphic = 'jsxgraph';
    script.onload = resolve;
    script.onerror = function() {
      jsxScriptPromise = null;
      reject(new Error('The 2D graphic library could not be loaded.'));
    };
    document.head.appendChild(script);
  });
  return jsxScriptPromise;
}

function loadModule(name) {
  if (!modulePromises[name]) {
    modulePromises[name] = import(assetUrl(name)).catch(function(error) {
      delete modulePromises[name];
      throw error;
    });
  }
  return modulePromises[name];
}

async function mountGraphic(host, payload) {
  const engine = engineOf(payload);
  if (engine === 'jsxgraph') {
    await Promise.all([loadStyleOnce(), loadScriptOnce()]);
    const module = await loadModule('jsxgraph-renderer.js');
    const validation = module.validateJsxGraphPayload(payload);
    if (!validation.valid || !module.mountJsxGraph(host, payload)) {
      throw new Error('Invalid JSXGraph payload.');
    }
    return;
  }
  if (engine === 'table') {
    const module = await loadModule('table-renderer.js');
    const validation = module.validateTablePayload(payload);
    if (!validation.valid || !module.mountTable(host, payload)) {
      throw new Error('Invalid table payload.');
    }
    await module.typesetTableMath(host);
    return;
  }
  if (engine === 'chart') {
    const module = await loadModule('chart-renderer.js');
    const validation = module.validateChartPayload(payload);
    if (!validation.valid) throw new Error('Invalid chart payload.');
    await module.ensureChartJs();
    if (!module.mountChart(host, payload)) throw new Error('The chart could not be mounted.');
    return;
  }
  if (engine === 'three3d') {
    const module = await loadModule('g3scene.js');
    const validation = module.validateThree3dPayload(payload);
    if (!validation.valid || !module.mountThree3d(host, payload)) {
      throw new Error('Invalid Three.js payload.');
    }
    return;
  }
  throw new Error(`Unsupported graphic engine: ${engine || '(empty)'}`);
}

export function isSuperGraphicPayload(payload) {
  return Boolean(payload && typeof payload === 'object' && SUPPORTED_ENGINES.has(engineOf(payload)));
}

export function preloadSuperGraphicEngine() {
  return Promise.resolve(true);
}

export function renderSuperGraphicPayload(payload) {
  const hostId = `bible_graphic_${Math.random().toString(36).slice(2, 11)}`;
  setTimeout(function() {
    const host = document.getElementById(hostId);
    if (!host) return;
    mountGraphic(host, payload).catch(function(error) {
      console.error('Bible graphic render failed:', error);
      host.innerHTML = '<div style="padding:22px;text-align:center;color:#92400e;background:#fffbeb;border-radius:8px;">This graphic could not be displayed.</div>';
    });
  }, 0);

  return '<div class="gongboo-graphic-frame" style="margin:15px 0;padding:12px;background:#fff;border:1px solid #dbe3ee;border-radius:10px;">' +
    '<div id="' + hostId + '" style="min-height:360px;display:grid;place-items:center;color:#64748b;font-size:13px;">Loading graphic...</div>' +
    '</div>';
}
