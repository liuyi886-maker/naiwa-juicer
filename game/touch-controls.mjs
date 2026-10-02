// Each button owns one pointer; different buttons remain independent for multitouch.
export function bindTouchControls(root,{
 isActive,onInteract,onHold,onTapPulse,onBeginFire,onReleaseFire,onCancelFire,onBait,
 now=()=>performance.now(),
}){
 const controls=[];
 const releaseCapture=({button},pointer)=>{
  // Capture may already have been released by the browser after cancellation.
  try{if(button.hasPointerCapture(pointer))button.releasePointerCapture(pointer);}catch{}
 };
 const detach=control=>{
  const pointer=control.pointer;
  control.pointer=null;
  control.button.classList.remove('pressed');
  return pointer;
 };
 const finish=(control,event,cancelled=false)=>{
  if(control.pointer===null||control.pointer!==event.pointerId)return;
  if(!cancelled)event.preventDefault();
  const pointer=detach(control);
  releaseCapture(control,pointer);
  if(control.hold){
   onHold(control.hold,false);
   if(!cancelled&&isActive())onTapPulse(control.hold,Math.max(0,.18-(now()-control.since)/1000));
  }else if(control.action==='fire'){
   if(!cancelled&&isActive())onReleaseFire();else onCancelFire();
  }
 };
 const bind=(button,hold,action)=>{
  const control={button,hold,action,pointer:null,since:0};
  controls.push(control);
  button.addEventListener('pointerdown',event=>{
   event.preventDefault();
   if(control.pointer!==null||!isActive())return;
   onInteract();
   if(action==='fire'&&!onBeginFire())return;
   control.pointer=event.pointerId;
   control.since=now();
   if(hold){onHold(hold,true);button.classList.add('pressed');}
   // Bait also owns its pointer until release, avoiding repeated drops from a
   // second finger while the first remains on the same button.
   try{button.setPointerCapture(event.pointerId);}catch{}
   if(action==='bait')onBait();
  });
  button.addEventListener('pointerup',event=>finish(control,event));
  button.addEventListener('pointercancel',event=>finish(control,event,true));
  button.addEventListener('lostpointercapture',event=>finish(control,event,true));
 };
 for(const button of root.querySelectorAll('[data-hold]'))bind(button,button.dataset.hold,null);
 for(const button of root.querySelectorAll('[data-action]'))bind(button,null,button.dataset.action);
 return {
  reset(){
   // Detach every owner before releasing capture or invoking game callbacks:
   // lostpointercapture can fire synchronously and must not finish a new press.
   const active=controls.filter(control=>control.pointer!==null)
    .map(control=>({control,pointer:detach(control)}));
   for(const {control,pointer} of active)releaseCapture(control,pointer);
   for(const {control} of active)if(control.hold)onHold(control.hold,false);
   onCancelFire();
  },
 };
}
