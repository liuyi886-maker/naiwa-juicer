// A binary bundle avoids base64 overhead and a separate network round-trip per atlas.
// Only the static build uses this; the editable development site still loads files.
export function unpackStartup(buffer,{makeURL=blob=>URL.createObjectURL(blob)}={}){
 const bytes=new Uint8Array(buffer);
 if(bytes.length<4)throw new Error('Incomplete startup pack');
 const headerSize=new DataView(buffer).getUint32(0,true),start=4+headerSize;
 if(headerSize>100000||start>bytes.length)throw new Error('Invalid startup header');
 const entries=JSON.parse(new TextDecoder().decode(bytes.subarray(4,start)));
 for(const e of Object.values(entries))if(!Number.isInteger(e.offset)||!Number.isInteger(e.length)||e.offset<0||e.length<=0||start+e.offset+e.length>bytes.length||!['image/webp','audio/mpeg'].includes(e.type))throw new Error('Invalid startup entry');
 return Object.fromEntries(Object.entries(entries).map(([name,e])=>[name,makeURL(new Blob([bytes.subarray(start+e.offset,start+e.offset+e.length)],{type:e.type}))]));
}
export async function prepareStartupPack(url){
 try{
  const buffer=await (globalThis.naiwaStartupDownload||fetch(url).then(r=>{if(!r.ok)throw new Error('Startup download failed');return r.arrayBuffer();}));
  if(!buffer)return {};
  return unpackStartup(buffer);
 }catch(error){
  // A malformed response must not poison every future visit's cached pack.
  try{await (await caches.open('naiwa-packs-v1')).delete(url);}catch{}
  console.warn('Startup pack unavailable; retrying individual assets',error.message);return {};
 }
}

// Workshop art has its own immutable cache and is not on the path to starting a hunt.
export async function prepareScenePack(url){
 const controller=new AbortController();let timer;
 const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>controller.abort(),15000);};
 try{
  reset();let cache,cached;try{cache=await caches.open('naiwa-scenes-v1');cached=await cache.match(url);}catch{}
  const response=cached||await fetch(url,{signal:controller.signal});if(!response.ok)throw Error('Scene download failed');
  const copy=cache&&!cached?response.clone():null;
  let buffer;
  if(response.body){const reader=response.body.getReader(),parts=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;parts.push(value);size+=value.length;reset();}const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}buffer=bytes.buffer;}
  else buffer=await response.arrayBuffer();
  const images=unpackStartup(buffer);
  if(copy)cache.put(url,copy).then(async()=>{const keys=await cache.keys();for(const key of keys.slice(0,-2))await cache.delete(key);}).catch(()=>{});
  return images;
 }catch{try{await (await caches.open('naiwa-scenes-v1')).delete(url);}catch{}return {};}
 finally{clearTimeout(timer);}
}
