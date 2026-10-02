// Decode the actual menu image before enabling play. Native controls remain usable on failure.
export function preparePauseMenu(image,panel,{timeoutMs=1500}={}){
 let timer;
 const decoded=Promise.resolve().then(()=>image.decode()).then(()=>{panel.classList.add('art-ready');return true;}).catch(()=>false);
 const bounded=new Promise(resolve=>{timer=setTimeout(()=>resolve(false),timeoutMs);});
 return Promise.race([decoded,bounded]).finally(()=>clearTimeout(timer));
}
