// GongBoo Super JSON -> JSXGraph adapter (2D package).
// The Super JSON schema remains GongBoo-owned; JSXGraph is only the renderer.
function numberRange(value, fallback) {
  return Array.isArray(value) && value.length === 2 && Number(value[0]) < Number(value[1])
    ? [Number(value[0]), Number(value[1])] : fallback;
}

function attributes(style = {}) {
  return Object.assign({}, style, {
    strokeColor: style.strokeColor || style.stroke || style.color || '#2563eb',
    fillColor: style.fillColor || style.fill || 'none',
    strokeWidth: Number(style.strokeWidth || 2),
    dash: Number.isFinite(Number(style.dash)) ? Number(style.dash) : (style.lineStyle === 'dashed' ? 2 : 0),
    fixed: true,
    highlight: false
  });
}

function evaluate(expression) {
  if (!window.math || !expression) return null;
  try {
    const compiled = window.math.compile(String(expression));
    return (x, y, t) => {
      const value = Number(compiled.evaluate({ x, y, t, pi: Math.PI, e: Math.E }));
      return Number.isFinite(value) ? value : NaN;
    };
  } catch (_) { return null; }
}

function mountScene(host, scene) {
  const coord = scene.coordinateSystem || {};
  const xRange = numberRange(coord.xRange, [-10, 10]);
  const yRange = numberRange(coord.yRange, [-10, 10]);
  const boardId = 'gongboo-jxg-' + Math.random().toString(36).slice(2);
  // The quiz page does not include the old Viewer CSS. Keep dimensions on
  // the board itself so JSXGraph never collapses to a zero-height element.
  const boardStyle = scene.square === true
    ? 'width:100%;height:auto;aspect-ratio:1 / 1'
    : 'width:100%;height:400px';
  host.innerHTML = '<div id="' + boardId + '" class="jxgbox gongboo-jxg-board" style="' + boardStyle + '"></div>';
  const board = window.JXG.JSXGraph.initBoard(boardId, {
    boundingbox: [xRange[0], yRange[1], xRange[1], yRange[0]],
    axis: coord.axis !== false, grid: !!coord.grid, showCopyright: false, showNavigation: false,
    // Mathematical figures must preserve equal x/y units: circles stay circles.
    keepaspectratio: true
  });
  const points = {};
  const curves = {};
  const items = Array.isArray(scene.items) ? scene.items : [];
  items.forEach(item => {
    const style = attributes(item.style);
    if (item.type === 'point' && Array.isArray(item.position)) {
      const p = board.create('point', item.position, Object.assign(style, { name: item.label || '', size: item.marker === 'none' ? 0 : 2, fillColor: item.marker === 'open' ? '#ffffff' : (style.fillColor === 'none' ? style.strokeColor : style.fillColor) }));
      if (item.id) points[item.id] = p;
    }
  });
  items.filter(item => item.type === 'curve' && item.expression).forEach(item => {
    const fn = evaluate(item.expression), domain = numberRange(item.domain, xRange);
    if (fn) curves[item.id || item.expression] = { fn, domain };
  });
  items.filter(item => item.type === 'region' && item.boundary && item.boundary.between).forEach(item => {
    const between = item.boundary.between;
    const upper = curves[between.upper], lower = curves[between.lower];
    const domain = numberRange(between.xRange, upper && lower ? [Math.max(upper.domain[0], lower.domain[0]), Math.min(upper.domain[1], lower.domain[1])] : null);
    if (!upper || !lower || !domain) return;
    const count = 180, xs = [], ys = [];
    for (let index = 0; index <= count; index++) {
      const x = domain[0] + (domain[1] - domain[0]) * index / count, y = upper.fn(x);
      if (Number.isFinite(y)) { xs.push(x); ys.push(y); }
    }
    for (let index = count; index >= 0; index--) {
      const x = domain[0] + (domain[1] - domain[0]) * index / count, y = lower.fn(x);
      if (Number.isFinite(y)) { xs.push(x); ys.push(y); }
    }
    if (xs.length >= 6) board.create('curve', [xs, ys], {
      strokeOpacity: 0,
      fillColor: item.style?.fill || '#2563eb',
      fillOpacity: Number(item.style?.fillOpacity ?? 0.18),
      fixed: true,
      highlight: false,
      curveType: 'plot'
    });
  });
  items.forEach(item => {
    const style = attributes(item.style);
    if (item.type === 'curve' && item.expression) {
      const curve = curves[item.id || item.expression];
      if (curve) board.create('functiongraph', [curve.fn, curve.domain[0], curve.domain[1]], style);
    } else if (item.type === 'polyline' && Array.isArray(item.points) && item.points.length > 1) {
      board.create('curve', [item.points.map(p => p[0]), item.points.map(p => p[1])], Object.assign(style, { curveType: 'plot' }));
    } else if ((item.type === 'segment' || item.type === 'connector' || item.type === 'vector') && Array.isArray(item.from) && Array.isArray(item.to)) {
      board.create(item.type === 'vector' ? 'arrow' : 'segment', [item.from, item.to], style);
    } else if (item.type === 'line' && Array.isArray(item.through) && item.through.length === 2) {
      board.create('line', item.through, style);
    } else if (item.type === 'line' && Number.isFinite(Number(item.y))) {
      board.create('line', [[xRange[0], Number(item.y)], [xRange[1], Number(item.y)]], style);
    } else if (item.type === 'line' && Number.isFinite(Number(item.x))) {
      board.create('line', [[Number(item.x), yRange[0]], [Number(item.x), yRange[1]]], style);
    } else if (item.type === 'circle' && Array.isArray(item.center) && Number.isFinite(Number(item.radius))) {
      board.create('circle', [item.center, Number(item.radius)], style);
    } else if (item.type === 'polygon' && Array.isArray(item.points) && item.points.length >= 3) {
      board.create('polygon', item.points, style);
    } else if (item.type === 'text' && Array.isArray(item.position)) {
      board.create('text', [item.position[0], item.position[1], String(item.value || '')], Object.assign(style, { display: 'html' }));
    }
  });
  return board;
}

function legacyCalculusScene(payload) {
  const data = payload && payload.data;
  if (!data || !String(payload.type || '').startsWith('calculus.')) return null;
  const curveItems = Array.isArray(data.curves) ? data.curves.map((curve, index) => ({
    id: curve.id || ('curve' + index), type: 'curve', expression: curve.expression,
    domain: curve.domain, style: curve.style || {}
  })) : [];
  if (payload.type === 'calculus.piecewise' && Array.isArray(data.pieces)) {
    data.pieces.forEach((piece, index) => curveItems.push({ id: 'piece' + index, type: 'curve', expression: piece.expression, domain: piece.domain, style: piece.style || {} }));
  }
  if (payload.type === 'calculus.regionBetweenCurves' && data.region) {
    curveItems.push({
      type: 'region',
      boundary: { between: {
        upper: data.region.upper,
        lower: data.region.lower,
        xRange: data.region.xRange
      } },
      style: data.region.style || { fill: '#2563eb', fillOpacity: 0.18 }
    });
  }
  return curveItems.length ? { coordinateSystem: data.coordinateSystem || {}, items: curveItems } : null;
}

function jsxGraphScene(payload) {
  if (!payload || String(payload.engine || '').toLowerCase() !== 'jsxgraph') return null;
  const board = payload.board || {};
  const boundingbox = Array.isArray(board.boundingbox) && board.boundingbox.length === 4 ? board.boundingbox.map(Number) : [-10, 10, 10, -10];
  if (!(boundingbox[0] < boundingbox[2] && boundingbox[3] < boundingbox[1])) return null;
  const objects = Array.isArray(payload.objects) ? payload.objects : [];
  const items = objects.map((object, index) => {
    const type = String(object.type || '').toLowerCase();
    const id = object.id || ('object' + index);
    const style = object.attributes || object.style || {};
    if (type === 'point') return { type: 'point', id, position: object.coords || object.position, label: object.name || object.label || '', style };
    if (type === 'functiongraph') return { type: 'curve', id, expression: object.expression, domain: object.range || object.domain, style };
    if (type === 'parametric') {
      const xFn = evaluate(object.xExpression), yFn = evaluate(object.yExpression), range = numberRange(object.range, [0, 1]);
      const points = [];
      if (xFn && yFn && range) for (let step = 0; step <= 180; step++) { const t = range[0] + (range[1] - range[0]) * step / 180, x = xFn(0, 0, t), y = yFn(0, 0, t); if (Number.isFinite(x) && Number.isFinite(y)) points.push([x, y]); }
      return { type: 'polyline', id, points, style };
    }
    if (type === 'polar') {
      const rFn = evaluate(object.rExpression), range = numberRange(object.range, [0, 2 * Math.PI]);
      const points = [];
      if (rFn && range) for (let step = 0; step <= 240; step++) { const t = range[0] + (range[1] - range[0]) * step / 240, r = rFn(0, 0, t); if (Number.isFinite(r)) points.push([r * Math.cos(t), r * Math.sin(t)]); }
      return { type: 'polyline', id, points, style };
    }
    if (type === 'segment' || type === 'arrow') return { type: type === 'arrow' ? 'vector' : 'segment', id, from: object.from, to: object.to, style };
    if (type === 'line') return { type: 'line', id, through: object.through, x: object.x, y: object.y, style };
    if (type === 'circle') return { type: 'circle', id, center: object.center, radius: object.radius, style };
    if (type === 'polygon') return { type: 'polygon', id, points: object.points, style };
    if (type === 'text') return { type: 'text', id, position: object.position, value: object.value || object.text || '', style };
    if (type === 'regionbetweencurves') return { type: 'region', id, boundary: { between: { upper: object.upper, lower: object.lower, xRange: object.range || object.xRange } }, style };
    return { type: 'unsupported', id };
  });
  return {
    coordinateSystem: { xRange: [boundingbox[0], boundingbox[2]], yRange: [boundingbox[3], boundingbox[1]], grid: !!board.grid, axis: board.axis !== false },
    square: board.square === true,
    items
  };
}

export function validateJsxGraphPayload(payload) {
  const errors = [];
  if (!payload || String(payload.engine || '').toLowerCase() !== 'jsxgraph') errors.push({ code: 'JSXGRAPH_ENGINE_REQUIRED', path: 'engine', message: 'Expected engine: "jsxgraph".' });
  if (payload && payload.type === 'multiPanel') {
    const panels = payload?.data?.panels;
    if (!Array.isArray(panels) || !panels.length) errors.push({ code: 'JSXGRAPH_PANELS_REQUIRED', path: 'data.panels', message: 'multiPanel requires at least one panel.' });
    else panels.forEach((panel, index) => {
      if (!panel || !(panel.scene || panel.data)) errors.push({ code: 'JSXGRAPH_PANEL_SCENE_REQUIRED', path: 'data.panels[' + index + ']', message: 'Each panel requires a scene.' });
    });
    return { valid: errors.length === 0, errors, warnings: [] };
  }
  if (!payload || !Array.isArray(payload.objects) || !payload.objects.length) errors.push({ code: 'JSXGRAPH_OBJECTS_REQUIRED', path: 'objects', message: 'objects must contain at least one JSXGraph object.' });
  if (payload && Array.isArray(payload.objects)) payload.objects.forEach((object, index) => {
    if (!object || !object.type) errors.push({ code: 'JSXGRAPH_OBJECT_TYPE_REQUIRED', path: 'objects[' + index + '].type', message: 'Each object needs a type.' });
    if (object && String(object.type).toLowerCase() === 'functiongraph' && !object.expression) errors.push({ code: 'JSXGRAPH_EXPRESSION_REQUIRED', path: 'objects[' + index + '].expression', message: 'functiongraph requires an expression.' });
  });
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function mountJsxGraph(host, payload) {
  if (!window.JXG || !window.JXG.JSXGraph) return null;
  if (payload.type === 'multiPanel') {
    const panels = payload?.data?.panels || [];
    const columns = Math.min(3, Number(payload?.data?.layout?.columns) || (panels.length <= 2 ? panels.length : 2));
    host.innerHTML = '<div class="gongboo-jxg-panels" style="grid-template-columns:repeat(' + columns + ',minmax(0,1fr))"></div>';
    panels.forEach(panel => { const card = document.createElement('section'); card.className = 'gongboo-jxg-panel'; if (panel.title || panel.id) card.innerHTML = '<div>' + (panel.title || panel.id) + '</div>'; const target = document.createElement('div'); card.appendChild(target); host.firstElementChild.appendChild(card); mountScene(target, panel.scene || panel.data); });
    return true;
  }
  const scene = jsxGraphScene(payload) || (payload.type === 'scene' ? payload.data : legacyCalculusScene(payload));
  if (!scene) return null;
  mountScene(host, scene);
  return true;
}
