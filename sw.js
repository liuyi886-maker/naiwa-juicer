const CACHE='naiwa-static-544c6753ea4f';
const PREFIX='naiwa-static-';
const scope=new URL(self.registration.scope);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled([scope.href,new URL('game/app-DJ6K5BGF.mjs',scope).href].map(url=>cache.add(new Request(url,{cache:'force-cache'}))))).catch(()=>{}).then(()=>self.skipWaiting()));
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
  const hashed=own&&/\/(?:startup-[a-f0-9]+\.bin|app-[A-Z0-9]+\.mjs)$/.test(url.pathname);
  const cached=await cache.match(key)||(hashed?await caches.match(key):undefined);
  // Deliver headers/body immediately; storing a clone may wait for the entire media stream.
  const download=async()=>{const response=await fetch(request);if(response.ok&&response.status===200){try{event.waitUntil(cache.put(key,response.clone()).catch(()=>{}));}catch{}}return response;};
  if(request.mode!=='navigate'&&cached)return cached;
  if(request.mode==='navigate'&&cached){
   const network=download();event.waitUntil(network.catch(()=>{}));
   return Promise.race([network.catch(()=>cached),new Promise(resolve=>setTimeout(()=>resolve(cached),2500))]);
  }
  try{return await download();}catch(error){if(cached)return cached;throw error;}
 })());
});
