// Shared, bounded downloads keep phones from decoding every large atlas at once.
export function createAssetLoader({imageFactory=()=>new Image(),fetcher=(...args)=>fetch(...args),concurrency=6}={}){
 const cache=new Map(),queue=[];let active=0;
 function pump(){while(active<concurrency&&queue.length){active++;const {task,resolve,reject}=queue.shift();Promise.resolve().then(task).then(resolve,reject).finally(()=>{active--;pump();});}}
 function schedule(task){return new Promise((resolve,reject)=>{queue.push({task,resolve,reject});pump();});}
 function memo(key,task){if(!cache.has(key)){const promise=schedule(async()=>{for(let attempt=0;;attempt++){try{return await task();}catch(error){if(attempt>=1)throw error;}}}).catch(error=>{cache.delete(key);throw error;});cache.set(key,promise);}return cache.get(key);}
 return {
  image:url=>memo(url,()=>new Promise((resolve,reject)=>{const im=imageFactory();im.decoding='async';const timer=setTimeout(()=>{im.onload=im.onerror=null;im.src='';reject(new Error(`图片加载超时: ${url}`));},45000);im.onload=async()=>{try{await im.decode();resolve(im);}catch(error){reject(error);}finally{clearTimeout(timer);}};im.onerror=()=>{clearTimeout(timer);reject(new Error(`图片暂时无法加载: ${url}`));};im.src=url;})),
  json:url=>memo(url,async()=>{const r=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`素材配置加载失败: ${url}`);return r.json();})
 };
}
export const assets=createAssetLoader();
