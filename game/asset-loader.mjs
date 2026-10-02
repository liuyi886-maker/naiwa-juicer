// Shared, bounded downloads keep phones from decoding every large atlas at once.
export function createAssetLoader({imageFactory=()=>new Image(),fetcher=(...args)=>fetch(...args),concurrency=6,variants={},mirrorBases=[],hedgeMs=900,imageTimeoutMs=45000}={}){
 const cache=new Map(),queue=[];let active=0,preferred=0;
 function pump(){while(active<concurrency&&queue.length){active++;const {task,resolve,reject}=queue.shift();Promise.resolve().then(task).then(resolve,reject).finally(()=>{active--;pump();});}}
 function schedule(task){return new Promise((resolve,reject)=>{queue.push({task,resolve,reject});pump();});}
 function memo(key,task){if(!cache.has(key)){const promise=schedule(async()=>{for(let attempt=0;;attempt++){try{return await task();}catch(error){if(attempt>=1)throw error;}}}).catch(error=>{cache.delete(key);throw error;});cache.set(key,promise);}return cache.get(key);}
 return {
  image:url=>memo(url,()=>new Promise((resolve,reject)=>{
   const variant=variants[url],file=variant?.path||url;
   const sources=[file,...(file.startsWith('assets/')?mirrorBases.map(base=>base+file):[])];
   const order=[Math.min(preferred,sources.length-1),...sources.map((_,i)=>i).filter(i=>i!==Math.min(preferred,sources.length-1))],urls=order.map(i=>sources[i]);
   const attempts=new Map(),timers=[];let settled=false,failures=0;
   const stop=winner=>{for(const t of timers)clearTimeout(t);for(const [i,im] of attempts){im.onload=im.onerror=null;if(i!==winner)im.src='';}};
   function launch(index){
    if(settled||index>=urls.length||attempts.has(index))return;
    const im=imageFactory();attempts.set(index,im);im.decoding='async';im.crossOrigin='anonymous';
    let failed=false;
    const fail=()=>{if(settled||failed)return;failed=true;im.onload=im.onerror=null;im.src='';failures++;launch(index+1);if(failures===urls.length){settled=true;stop();reject(new Error(`图片暂时无法加载: ${url}`));}};
    timers.push(setTimeout(fail,imageTimeoutMs));
    im.onload=async()=>{try{await im.decode();if(settled||failed)return;settled=true;if(order[index]>0)preferred=order[index];im.assetScaleX=variant?.scaleX||1;im.assetScaleY=variant?.scaleY||1;stop(index);resolve(im);}catch{fail();}};
    im.onerror=fail;im.src=urls[index];
   }
   launch(0);for(let i=1;i<urls.length;i++)timers.push(setTimeout(()=>launch(i),hedgeMs*i));
  })),
  json:url=>memo(url,async()=>{const r=await fetcher(url,{signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`素材配置加载失败: ${url}`);return r.json();})
 };
}
export const assets=createAssetLoader();
