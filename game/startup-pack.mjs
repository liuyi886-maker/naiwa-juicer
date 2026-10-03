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
