const CACHE='naiwa-static-747f09232ea8';
const PREFIX='naiwa-static-';
const scope=new URL(self.registration.scope);
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE).then(cache=>cache.add(new Request(scope.href,{cache:'reload'}))).catch(()=>{}));
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{const keys=(await caches.keys()).filter(k=>k.startsWith(PREFIX));for(const key of keys.slice(0,-2))if(key!==CACHE)await caches.delete(key);await self.clients.claim();})());
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||url.pathname.endsWith('/sw.js'))return;
 if(request.mode!=='navigate'&&!/\.(?:webp|mjs|js|css|json|mp3|wav)$/.test(url.pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  const key=request.mode==='navigate'?scope.href:request;
  const cached=await cache.match(key);
  const download=async()=>{const response=await fetch(request);if(response.ok&&response.status===200){try{await cache.put(key,response.clone());}catch{}}return response;};
  if(request.mode!=='navigate'&&cached)return cached;
  if(request.mode==='navigate'&&cached){
   const network=download();event.waitUntil(network.catch(()=>{}));
   return Promise.race([network.catch(()=>cached),new Promise(resolve=>setTimeout(()=>resolve(cached),2500))]);
  }
  try{return await download();}catch(error){if(cached)return cached;throw error;}
 })());
});
