(function () {
  'use strict';

  var KEY = 'gongboo_last_system_v1';
  var URLS = {
    bible: 'https://biblegongboo.github.io/bible/supabase/app/',
    license: 'https://biblegongboo.github.io/license/app/'
  };
  var root = {
    name: 'Select Study',
    children: [
      { name: 'Bible', id: 'BIBLE', url: URLS.bible },
      { name: 'License', id: 'LICENSE', url: URLS.license }
    ]
  };

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (_) { return null; }
  }

  function destination(url) {
    var params = new URLSearchParams(location.search);
    var androidApp = params.get('app') === 'android' || params.get('mobile') === 'quiz';
    if (!androidApp) return url;
    return url === URLS.bible ? url + '?mobile=quiz&app=android' : url + '?app=android';
  }

  function mount() {
    var logo = document.querySelector('.sat-logo');
    var legacy = document.querySelector('.sat-title');
    if (!logo || !legacy) return;

    var host = document.createElement('div');
    host.className = 'gongboo-nav-host';
    logo.insertBefore(host, legacy);
    legacy.classList.add('gongboo-nav-legacy');

    var button = document.createElement('button');
    button.className = 'gongboo-nav-button';
    button.type = 'button';
    host.appendChild(button);

    function label() {
      button.innerHTML = '<span class="gongboo-nav-label"></span><span>▾</span>';
      button.firstChild.textContent = (read() || {}).name || 'Select Study';
    }
    label();

    var shade = document.createElement('div');
    shade.className = 'gongboo-nav-backdrop';
    shade.hidden = true;
    shade.innerHTML = '<section class="gongboo-nav-panel" role="dialog" aria-modal="true" aria-label="Select study"><header class="gongboo-nav-head"><button data-back aria-label="Back">‹</button><div class="gongboo-nav-path"></div><button data-close aria-label="Close">×</button></header><div class="gongboo-nav-list"></div></section>';
    document.body.appendChild(shade);

    var list = shade.querySelector('.gongboo-nav-list');
    var path = shade.querySelector('.gongboo-nav-path');

    function render() {
      path.textContent = root.name;
      list.innerHTML = '';
      root.children.forEach(function (child) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'gongboo-nav-item';
        item.innerHTML = '<span></span><span></span>';
        item.firstChild.textContent = child.name;
        item.onclick = function () {
          localStorage.setItem(KEY, JSON.stringify({ id: child.id, name: child.name }));
          label();
          shade.hidden = true;
          location.href = destination(child.url);
        };
        list.appendChild(item);
      });
    }

    function positionPanel() {
      if (window.innerWidth > 600) {
        shade.style.removeProperty('--gongboo-nav-top');
        shade.style.removeProperty('--gongboo-nav-left');
        shade.style.removeProperty('--gongboo-nav-width');
        return;
      }
      var rect = button.getBoundingClientRect();
      var width = Math.min(300, window.innerWidth - 24);
      var left = Math.max(12, Math.min(window.innerWidth - width - 12, rect.left));
      shade.style.setProperty('--gongboo-nav-top', Math.round(rect.bottom + 6) + 'px');
      shade.style.setProperty('--gongboo-nav-left', Math.round(left) + 'px');
      shade.style.setProperty('--gongboo-nav-width', Math.round(width) + 'px');
    }
    button.onclick = function () { render(); positionPanel(); shade.hidden = false; };
    window.addEventListener('resize', function () { if (!shade.hidden) positionPanel(); });
    shade.querySelector('[data-close]').onclick = function () { shade.hidden = true; };
    shade.querySelector('[data-back]').onclick = function () { shade.hidden = true; };
    shade.onclick = function (event) { if (event.target === shade) shade.hidden = true; };
    new MutationObserver(function () {
      if (button.parentNode !== host) { host.textContent = ''; host.appendChild(button); }
      if (!button.querySelector('.gongboo-nav-label')) label();
    }).observe(host, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
