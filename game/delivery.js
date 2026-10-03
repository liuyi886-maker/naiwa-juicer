// Verified failover for the program and artwork. Never execute a partially downloaded script.
(()=>{
 const manifest=__DELIVERY_MANIFEST__,bases=[new URL('.',location.href).href,'https://fastly.jsdelivr.net/gh/liuyi886-maker/naiwa-juicer@gh-pages/'];
 let preferred=0;const pending=new Map();
 window.naiwaDelivery={events:[],preferred:0};
 const log=(path,event,source)=>{const list=window.naiwaDelivery.events;list.push({path,event,source,at:Math.round(performance.now())});if(list.length>80)list.shift();};
 async function valid(bytes,meta){if(bytes.byteLength!==meta.bytes)return false;const digest=await crypto.subtle.digest('SHA-256',bytes);return [...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('')===meta.sha;}
 function network(path,meta,progress){return new Promise((resolve,reject)=>{
  const order=[preferred,1-preferred],controllers=[],timers=[];let settled=false,started=0,failures=0;
  const finish=(bytes,source)=>{if(settled)return;settled=true;timers.forEach(clearTimeout);controllers.forEach(c=>c?.abort());preferred=source;window.naiwaDelivery.preferred=source;log(path,'ready',source);resolve(bytes);};
  const launch=async()=>{
   if(settled||started>=order.length)return;const source=order[started++],controller=new AbortController();controllers.push(controller);let received=0,idle,slow;
   const keepAlive=()=>{clearTimeout(idle);idle=setTimeout(()=>{launch();controller.abort();},received?4000:10000);};
   keepAlive();slow=setTimeout(()=>{if(received<16000)launch();},1200);timers.push(slow);
   const hard=setTimeout(()=>{launch();controller.abort();},20000);timers.push(hard);
   try{
    log(path,'request',source);const response=await fetch(bases[source]+path,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);
    const reader=response.body?.getReader(),parts=[];
    if(reader){for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);received+=value.length;keepAlive();if(!settled)progress?.(received);}}
    else{const part=new Uint8Array(await response.arrayBuffer());parts.push(part);received=part.length;}
    const bytes=new Uint8Array(received);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    if(!await valid(bytes.buffer,meta))throw Error('Incomplete or changed file');
    finish(bytes.buffer,source);
   }catch(error){if(settled)return;failures++;log(path,error.message,source);launch();if(failures===order.length){settled=true;timers.forEach(clearTimeout);reject(Error('两条资源线路暂时不可用：'+path));}}
   finally{clearTimeout(idle);clearTimeout(slow);clearTimeout(hard);}
  };launch();
 });}
 window.naiwaFetchBytes=(path,{progress}={})=>{
  if(pending.has(path))return pending.get(path);const meta=manifest[path];if(!meta)return Promise.reject(Error('Unknown resource '+path));
  const job=(async()=>{let cache;try{cache=await caches.open('naiwa-delivery-v1');const cached=await cache.match(path);if(cached){const bytes=await cached.arrayBuffer();if(await valid(bytes,meta)){progress?.(bytes.byteLength);log(path,'cache',-1);return bytes;}await cache.delete(path);}}catch{}
   const bytes=await network(path,meta,progress);progress?.(bytes.byteLength);
   if(cache)cache.put(path,new Response(bytes,{headers:{'Content-Type':meta.type}})).catch(()=>{});
   return bytes;
  })();pending.set(path,job);job.catch(()=>pending.delete(path));return job;
 };
 window.naiwaFetchMedia=async path=>URL.createObjectURL(new Blob([await window.naiwaFetchBytes(path)],{type:manifest[path].type}));
 window.naiwaMusicDownload=window.naiwaFetchMedia('assets/instant-v1/bgm.mp3').catch(()=> 'assets/instant-v1/bgm.mp3');
 window.naiwaPrepareCover=()=>window.naiwaFetchMedia(matchMedia('(orientation: portrait)').matches?'assets/instant-v1/title-mobile.webp':'assets/instant-v1/title-screen.webp');
 window.naiwaCoverDownload=window.naiwaPrepareCover();window.naiwaCoverDownload.catch(()=>{});
})();
