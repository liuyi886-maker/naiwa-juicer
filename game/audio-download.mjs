// Hedge public audio downloads; a failed request is never cached as a successful sound.
export function downloadAudio(url,{mirrors=[],fetcher=fetch,delay=1500,timeout=20000}={}){
 const urls=[url,...mirrors.map(base=>base+url)];
 return new Promise((resolve,reject)=>{
  const active=new Map(),timers=[];let ended=false,failed=0;
  const finish=()=>{timers.forEach(clearTimeout);for(const controller of active.values())controller.abort();};
  function launch(i){if(ended||i>=urls.length||active.has(i))return;const controller=new AbortController();active.set(i,controller);const timer=setTimeout(()=>controller.abort(),timeout);timers.push(timer);
   fetcher(urls[i],{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error(`Audio HTTP ${r.status}`);return r.arrayBuffer();}).then(bytes=>{if(ended)return;ended=true;resolve(bytes);finish();}).catch(()=>{if(ended)return;failed++;launch(i+1);if(failed===urls.length){ended=true;finish();reject(Error('音频暂时无法下载'));}});
  }
  launch(0);for(let i=1;i<urls.length;i++)timers.push(setTimeout(()=>launch(i),delay*i));
 });
}
