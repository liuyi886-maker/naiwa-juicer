// Small immutable packs retry independently; a truncated response never restarts all artwork.
(()=>{
 const packs=__STARTUP_PACKS__,loaded=packs.map(()=>0),total=packs.reduce((sum,p)=>sum+p.bytes,0);
 const progress=(index,size)=>{loaded[index]=size;globalThis.naiwaStartupProgress={loaded:loaded.reduce((a,b)=>a+b,0),total};};
 globalThis.naiwaStartupProgress={loaded:0,total};
 async function download(pack,index){
  let cache;try{cache=await caches.open('naiwa-packs-v2');}catch{}
  for(let attempt=0;attempt<2;attempt++){
   const controller=new AbortController();let timer;
   const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),10000);};
   try{
    reset();const cached=await cache?.match(pack.url),response=cached||await fetch(pack.url,{signal:controller.signal});
    if(!response.ok)throw Error('Startup HTTP '+response.status);
    const reader=response.body?.getReader(),parts=[];let size=0;
    if(reader){for(;;){const part=await reader.read();if(part.done)break;parts.push(part.value);size+=part.value.length;progress(index,size);reset();}}
    else {const part=new Uint8Array(await response.arrayBuffer());parts.push(part);size=part.length;}
    if(size!==pack.bytes)throw Error('Incomplete startup pack');
    const result=new Uint8Array(size);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}
    progress(index,size);
    if(cache&&!cached)cache.put(pack.url,new Response(result,{headers:{'Content-Type':'application/octet-stream'}})).catch(()=>{});
    return result.buffer;
   }catch{progress(index,0);try{await cache?.delete(pack.url);}catch{}}
   finally{clearTimeout(timer);}
  }
  return null; // Only missing entries fall back to their individual image files.
 }
 globalThis.naiwaStartupDownload=(async()=>{
  const results=new Array(packs.length);let next=0;
  await Promise.all(Array.from({length:Math.min(3,packs.length)},async()=>{while(next<packs.length){const index=next++;results[index]=await download(packs[index],index);}}));
  try{const cache=await caches.open('naiwa-packs-v2'),keys=await cache.keys(),current=new Set(packs.map(p=>new URL(p.url,location.href).href));for(const key of keys.filter(k=>!current.has(k.url)).slice(0,-12))await cache.delete(key);}catch{}
  return results;
 })();
})();
