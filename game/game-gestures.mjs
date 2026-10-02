// Keep browser selection/zoom gestures away from the game without blocking modal scrolling.
export function installGameGestures(shell,{isPlaying=()=>true}={}){
 const doc=shell.ownerDocument;
 const element=target=>target?.nodeType===3?target.parentElement:target;
 const editable=target=>!!element(target)?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
 const within=target=>!!target&&shell.contains(element(target));
 const cancel=event=>{if(event.cancelable)event.preventDefault();};
 const stopCallout=event=>{if(!editable(event.target))cancel(event);};
 for(const name of ['contextmenu','selectstart','dragstart'])shell.addEventListener(name,stopCallout);
 const stopGesture=event=>{if(isPlaying()&&!editable(event.target))cancel(event);};
 for(const name of ['gesturestart','gesturechange','gestureend','dblclick'])shell.addEventListener(name,stopGesture,{passive:false});
 const stopTouchDefault=event=>{
  if(!isPlaying()||editable(event.target))return;
  const target=element(event.target);
  // The action pad uses Pointer Events. Native menu buttons still need their normal click.
  if(target?.closest?.('#touchControls')||!target?.closest?.('button,a,[role="button"],.intro,.overlay,#workshop'))cancel(event);
 };
 for(const name of ['touchstart','touchmove','touchend'])shell.addEventListener(name,stopTouchDefault,{passive:false});
 const clearGameSelection=()=>{
  if(!isPlaying())return;const selection=doc.getSelection();
  if(selection&&!selection.isCollapsed&&(within(selection.anchorNode)||within(selection.focusNode))&&!editable(selection.anchorNode)&&!editable(selection.focusNode))selection.removeAllRanges();
 };
 doc.addEventListener('selectionchange',clearGameSelection);
 return {clearSelection:clearGameSelection};
}
