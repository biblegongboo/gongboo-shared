(function(){
  'use strict';
  var adapters=new Map();
  window.GongBooGraphics=Object.freeze({
    version:'1.0.0',
    register:function(name,adapter){if(!name||!adapter)throw new Error('Graphics adapter name and implementation are required.');adapters.set(name,adapter);return adapter},
    get:function(name){return adapters.get(name)||null},
    mount:function(name,target,options){var adapter=adapters.get(name);if(!adapter||typeof adapter.mount!=='function')throw new Error('Graphics adapter is unavailable: '+name);return adapter.mount(target,options||{})},
    unmount:function(name,target){var adapter=adapters.get(name);if(adapter&&typeof adapter.unmount==='function')adapter.unmount(target)}
  });
})();
