(function(){
  'use strict';
  // New key intentionally discards old book/product labels. The navigator now
  // remembers systems only (Bible or License).
  var KEY='gongboo_last_system_v1';
  var URLS={bible:'https://biblegongboo.github.io/bible/supabase/app/',license:'https://biblegongboo.github.io/license/app/'};
  var root={name:'Select Study',children:[
    {name:'Bible',id:'BIBLE',url:URLS.bible},
    {name:'License',id:'LICENSE',url:URLS.license}
  ]};
  function read(){try{return JSON.parse(localStorage.getItem(KEY)||'null')}catch(_){return null}}
  function mount(){
    var logo=document.querySelector('.sat-logo'),legacy=document.querySelector('.sat-title');if(!logo||!legacy)return;
    var host=document.createElement('div');host.className='gongboo-nav-host';logo.insertBefore(host,legacy);legacy.classList.add('gongboo-nav-legacy');
    var button=document.createElement('button');button.className='gongboo-nav-button';button.type='button';host.appendChild(button);
    function label(){button.innerHTML='<span class="gongboo-nav-label"></span><span>▼</span>';button.firstChild.textContent=(read()||{}).name||'Select Study'}label();
    var shade=document.createElement('div');shade.className='gongboo-nav-backdrop';shade.hidden=true;shade.innerHTML='<section class="gongboo-nav-panel" role="dialog" aria-modal="true" aria-label="Select study"><header class="gongboo-nav-head"><button data-back aria-label="Back">‹</button><div class="gongboo-nav-path"></div><button data-close aria-label="Close">×</button></header><div class="gongboo-nav-list"></div></section>';document.body.appendChild(shade);
    var stack=[root],list=shade.querySelector('.gongboo-nav-list'),path=shade.querySelector('.gongboo-nav-path');
    function render(){var node=stack[stack.length-1];path.textContent=stack.map(function(x){return x.name}).join(' › ');list.innerHTML='';node.children.forEach(function(child){var item=document.createElement('button');item.type='button';item.className='gongboo-nav-item';item.innerHTML='<span></span><span>'+(child.children?'›':'')+'</span>';item.firstChild.textContent=child.name;item.onclick=function(){if(child.children){stack.push(child);render();return}localStorage.setItem(KEY,JSON.stringify({id:child.id,name:child.name}));label();shade.hidden=true;location.href=child.url};list.appendChild(item)})}
    button.onclick=function(){stack=[root];render();shade.hidden=false};shade.querySelector('[data-close]').onclick=function(){shade.hidden=true};shade.querySelector('[data-back]').onclick=function(){if(stack.length>1){stack.pop();render()}else shade.hidden=true};shade.onclick=function(e){if(e.target===shade)shade.hidden=true};
    new MutationObserver(function(){if(button.parentNode!==host){host.textContent='';host.appendChild(button)}if(!button.querySelector('.gongboo-nav-label'))label()}).observe(host,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
