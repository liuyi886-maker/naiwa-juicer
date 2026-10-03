// Injected at the beginning of <head>: artwork downloads alongside the small game code.
(()=>{
 const controller=new AbortController();let timer;
 const total=__STARTUP_BYTES__,url='__STARTUP_URL__';
 const progress=loaded=>{globalThis.naiwaStartupProgress={loaded,total};clearTimeout(timer);timer=setTimeout(()=>controller.abort(),15000);};
 progress(0);
 globalThis.naiwaStartupDownload=(async()=>{
  try{
   let cached;try{cached=await caches.match(url);}catch{}
   const response=cached||await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Startup HTTP '+response.status);
   if(!cached&&typeof caches!=='undefined'){
    const copy=response.clone();
    caches.open('naiwa-packs-v1').then(async cache=>{await cache.put(url,copy);const keys=await cache.keys();for(const key of keys.slice(0,-2))await cache.delete(key);}).catch(()=>{});
   }
   if(!response.body){const b=await response.arrayBuffer();progress(b.byteLength);return b;}
   const reader=response.body.getReader(),parts=[];let size=0;
   for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);size+=value.length;progress(size);}
   const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result.buffer;
  }catch{return null;}finally{clearTimeout(timer);}
 })();
})();
