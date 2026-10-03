const CACHE='naiwa-static-df2c4f6b37ad';
const PREFIX='naiwa-static-';
const scope=new URL(self.registration.scope);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled([scope.href,...['game/app-6SKX2VAV.mjs','assets/instant-v1/title-screen.webp','assets/instant-v1/title-mobile.webp','assets/instant-v1/bgm.mp3'].map(path=>new URL(path,scope).href)].map(async url=>{const existing=url!==scope.href?await caches.match(url):null;if(existing)return cache.put(url,existing);return cache.add(new Request(url,{cache:'force-cache'}));}))).catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{const keys=(await caches.keys()).filter(k=>k.startsWith(PREFIX));for(const key of keys.slice(0,-2))if(key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 const own=url.origin===scope.origin&&url.pathname.startsWith(scope.pathname);
 const mirror=(url.hostname==='raw.githubusercontent.com'&&url.pathname.startsWith('/liuyi886-maker/naiwa-juicer/'))||(url.hostname==='cdn.jsdelivr.net'&&url.pathname.startsWith('/gh/liuyi886-maker/naiwa-juicer@'));
 if(request.method!=='GET'||(!own&&!mirror)||url.pathname.endsWith('/sw.js'))return;
 if(request.mode!=='navigate'&&!/\.(?:webp|mjs|js|css|json|mp3|wav|bin)$/.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const key=request.mode==='navigate'?scope.href:request;
  // Content-addressed resources are safe to reuse from a previous release cache.
  const hashed=own&&/\/(?:(?:startup|workshop)-[a-f0-9]+\.bin|app-[A-Z0-9]+\.mjs)$/.test(url.pathname);
  const cached=await cache.match(key)||(hashed?await caches.match(key):undefined);
  // Deliver headers/body immediately; storing a clone may wait for the entire media stream.
  const download=async()=>{const response=await fetch(request);if(response.ok&&response.status===200){try{event.waitUntil(cache.put(key,response.clone()).catch(()=>{}));}catch{}}return response;};
  if(request.mode!=='navigate'&&cached){
   // Safari asks for byte ranges even when the complete music is already stored offline.
   const range=request.headers.get('range');
   if(range&&/\.(?:mp3|wav)$/.test(url.pathname)&&cached.status===200){
    const m=/^bytes=(\d*)-(\d*)$/.exec(range);
    if(m&&(m[1]||m[2])){
     const body=await cached.arrayBuffer(),size=body.byteLength;
     const start=m[1]?Number(m[1]):Math.max(0,size-Number(m[2]));
     const end=m[1]&&m[2]?Math.min(size-1,Number(m[2])):size-1;
     if(start>=size||end<start)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
     const headers=new Headers(cached.headers);headers.set('Content-Range',`bytes ${start}-${end}/${size}`);headers.set('Content-Length',String(end-start+1));headers.set('Accept-Ranges','bytes');
     return new Response(body.slice(start,end+1),{status:206,headers});
    }
   }
   return cached;
  }
  if(request.mode==='navigate'&&cached){
   const network=download();event.waitUntil(network.catch(()=>{}));
   return cached; // Reopen immediately; refresh the next visit without delaying this one.
  }
  try{return await download();}catch(error){if(cached)return cached;throw error;}
 })());
});
