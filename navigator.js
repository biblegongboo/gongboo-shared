(function(){
  'use strict';
  var KEY='gongboo_last_study_v2';
  var OT=['Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1-Samuel','2-Samuel','1-Kings','2-Kings','1-Chronicles','2-Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song-of-Solomon','Isaiah','Jeremiah','Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi'];
  var NT=['Matthew','Mark','Luke','John','Acts','Romans','1-Corinthians','2-Corinthians','Galatians','Ephesians','Philippians','Colossians','1-Thessalonians','2-Thessalonians','1-Timothy','2-Timothy','Titus','Philemon','Hebrews','James','1-Peter','2-Peter','1-John','2-John','3-John','Jude','Revelation'];
  var PRODUCTS={realestate:'Real Estate',insurance:'Insurance',mortgage:'Mortgage NMLS',notary:'Notary'};
  var URLS={bible:'https://biblegongboo.github.io/bible/supabase/app/',license:'https://biblegongboo.github.io/license/app/'};
  function book(name){return{name:name.replace(/-/g,' '),id:'BIB-'+name,url:URLS.bible+'?study='+encodeURIComponent('book:'+name)}}
  function product(code){return{name:PRODUCTS[code],id:'LIC-'+code,url:URLS.license+'?study='+encodeURIComponent('product:'+code)}}
  var root={name:'Select Study',children:[{name:'Bible',children:[{name:'Old Testament',children:OT.map(book)},{name:'New Testament',children:NT.map(book)}]},{name:'License',children:[{name:'National',children:[product('mortgage')]},{name:'California',children:[product('realestate'),product('insurance'),product('notary')]}]}]};
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
