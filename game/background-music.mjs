// Stream the original recording instead of waiting for the entire file to decode.
export class BackgroundMusic {
 constructor(context,output,{url,mirrors=[],audioFactory=()=>new Audio(),onStatus=()=>{},stallMs=8000}={}){
  this.urls=[url,...mirrors.map(base=>base+url)];this.index=0;this.generation=0;this.desired=false;this.pending=false;this.stallMs=stallMs;this.onStatus=onStatus;
  this.media=audioFactory();this.media.preload='auto';this.media.crossOrigin='anonymous';this.media.loop=true;this.media.playsInline=true;
  this.node=context.createMediaElementSource(this.media);this.node.connect(output);
  this.media.addEventListener('playing',()=>{this.clearWatch();this.setStatus('playing');});
  this.media.addEventListener('waiting',()=>this.watch());
  this.media.addEventListener('stalled',()=>this.watch());
  this.media.addEventListener('error',()=>this.nextSource());
  this.setSource();
 }
 setStatus(status){if(this.status!==status){this.status=status;this.onStatus(status);}}
 clearWatch(){clearTimeout(this.timer);this.timer=null;}
 watch(){if(!this.desired||this.timer)return;this.timer=setTimeout(()=>{this.timer=null;if(this.desired&&this.media.readyState<3)this.nextSource();},this.stallMs);}
 setSource(){this.clearWatch();this.generation++;this.pending=false;this.media.src=this.urls[this.index];this.setStatus('loading');}
 nextSource(){
  this.clearWatch();if(this.index>=this.urls.length-1){this.setStatus('error');return;}
  this.index++;this.setSource();if(this.desired)this.play();
 }
 play({retry=false}={}){
  this.desired=true;
  if(retry&&this.status==='error'){this.index=0;this.setSource();}
  if(this.status==='error'||this.pending)return;
  if(!this.media.paused&&this.media.readyState>=3){this.setStatus('playing');return;}
  const generation=this.generation;this.pending=true;this.watch();
  // Called directly within the trusted pointer/touch gesture as well as on resume.
  Promise.resolve(this.media.play()).then(()=>{if(generation!==this.generation)return;this.pending=false;if(this.desired)this.setStatus('playing');else this.media.pause();}).catch(error=>{
   if(generation!==this.generation)return;this.pending=false;
   if(error.name==='NotAllowedError'){this.clearWatch();this.setStatus('blocked');}
   else if(error.name!=='AbortError'&&this.desired)this.nextSource();
  });
 }
 setActive(active){if(active){if(!this.desired)this.play();}else if(this.desired){this.desired=false;this.generation++;this.pending=false;this.clearWatch();this.media.pause();this.setStatus('paused');}}
}
