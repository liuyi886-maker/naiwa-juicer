import {drawWholeRunner,drawWholePose,runFrame} from './fullbody.mjs?v=hunt-fixes-7';
import {speciesFor} from './species.mjs?v=hunter-avoidance-12';
import {RUN_CYCLE} from './motion.mjs?v=hunt-fixes-7';
const TAU=Math.PI*2;
export function gaitFoot(phase){
 const q=((phase/TAU)%1+1)%1,stance=.35,reach=RUN_CYCLE*stance/2;
 if(q<stance)return {x:reach-RUN_CYCLE*q,y:0,angle:0};
 const t=(q-stance)/(1-stance),e=t*t*(3-2*t);
 return {x:-reach+2*reach*e,y:-12*Math.sin(Math.PI*t),angle:.32*Math.sin(2*Math.PI*t)};
}
export function kneeFor(hip,foot,upper=28,lower=26){
 const dx=foot.x-hip.x,dy=foot.y-hip.y,d=Math.max(Math.abs(upper-lower)+.001,Math.min(upper+lower-.001,Math.hypot(dx,dy)));
 const cosine=Math.max(-1,Math.min(1,(upper*upper+d*d-lower*lower)/(2*upper*d)));
 const angle=Math.atan2(dy,dx)-Math.acos(cosine);
 return {x:hip.x+Math.cos(angle)*upper,y:hip.y+Math.sin(angle)*upper};
}
export function hunterLegPose(phase,far,blend=1,air=0,bob=0){
 const hip={x:far?-3:3,y:-56+bob},gait=gaitFoot(phase+(far?Math.PI:0)),rest=far?-8:10;
 const foot={x:rest+(gait.x-rest)*blend,y:gait.y*blend};
 foot.x+=((far?-13:16)-foot.x)*air;foot.y+=((far?-16:-6)-foot.y)*air;
 const ankle={x:foot.x,y:foot.y-12},knee=kneeFor(hip,ankle);
 return {hip,knee,ankle,foot,angle:gait.angle*blend*(1-air)+air*.14};
}
// One complete pose per draw in every state: no limb-rig fallback.
function actionPose(c,im,name,e,height){
 const meta=im?.runMeta,pose=meta?.poses?.[name];
 return drawWholePose(c,im?.runAtlas,pose?{...meta,frames:[pose]}:meta,0,e.x,e.y,height,e.dir);
}
export function drawHunter(c,im,p,time){
 if(!im)return;
 if(!p.grounded)return actionPose(c,im,'air',p,125);
 if(p.stun>0)return actionPose(c,im,'stun',p,125);
 if(Math.abs(p.vx)>18)return drawWholeRunner(c,im.runAtlas,im.runMeta,p,125,RUN_CYCLE);
 return actionPose(c,im,p.shot>0?'shoot':'idle',p,125);
}
export function drawDog(c,im,d,time){
 if(!im||d.state==='cleared')return;
 c.save();if(d.state==='retreat')c.globalAlpha=Math.max(0,1-d.timer/.4);
 if(['patrol','charge','retreat'].includes(d.state))drawWholeRunner(c,im.runAtlas,im.runMeta,d,83,150);
 else actionPose(c,im,d.state==='alert'?'alert':d.state==='recover'?'recover':'idle',d,83);
 c.restore();
}
export function drawPrey(c,im,z,time){
 if(!im)return;
 if(z.species&&z.species!=='basic'){drawSpecies(c,im,z,time);return;}
 const taunt=z.state==='taunt'&&im.tauntAtlas&&im.tauntMeta;
 const meta=taunt?im.tauntMeta:im.runMeta,atlas=taunt?im.tauntAtlas:im.runAtlas;
 if(!meta)return;
 const frame=taunt?movingTauntFrame(z.timer,meta.frames.length):['run','walk','escaping'].includes(z.state)?runFrame(z.stride,150,meta.frames.length):0;
 return drawWholePose(c,atlas,meta,frame,z.x,z.y,118,z.dir);
}
export function movingTauntFrame(timer,count=8){return Math.floor(Math.max(0,timer||0)*10)%count;}

export async function loadSpeciesSprites(im){
 im.speciesSprites={};
 await Promise.all(['hopper','bird','shell','longbody'].map(async id=>{
  const atlas=new Image();atlas.src=`assets/characters/${id}/animations/run-fullbody-v1.png`;
  const [meta]=await Promise.all([fetch(`assets/characters/${id}/animations/run-fullbody-v1.json`).then(r=>{if(!r.ok)throw new Error(id);return r.json();}),atlas.decode()]);
  const tauntAtlas=new Image();tauntAtlas.src=`assets/characters/${id}/animations/taunt-moving-v1.png`;
  const [tauntMeta]=await Promise.all([fetch(`assets/characters/${id}/animations/taunt-moving-v1.json`).then(r=>r.json()),tauntAtlas.decode()]);
  im.speciesSprites[id]={atlas,meta,tauntAtlas,tauntMeta};
  if(id==='bird'){const flightAtlas=new Image();flightAtlas.src='assets/characters/bird/animations/fly-fullbody-v1.png';const [flightMeta]=await Promise.all([fetch('assets/characters/bird/animations/fly-fullbody-v1.json').then(r=>r.json()),flightAtlas.decode()]);Object.assign(im.speciesSprites[id],{flightAtlas,flightMeta});}
 }));
}
function drawSpecies(c,im,z,time){
 const sprite=im.speciesSprites?.[z.species];if(!sprite)return;
 const spec=speciesFor(z),moving=['run','walk','escaping'].includes(z.state);
 if(z.state==='taunt'&&sprite.tauntAtlas&&sprite.tauntMeta){
  drawWholePose(c,sprite.tauntAtlas,sprite.tauntMeta,movingTauntFrame(z.timer,sprite.tauntMeta.frames.length),z.x,z.y,spec.height,z.dir);return;
 }
 const flying=z.species==='bird'&&z.flying&&z.state==='run'&&sprite.flightAtlas;
 const frame=flying?Math.floor(time*14)%8:moving?runFrame(z.stride,spec.cycle,sprite.meta.frames.length):1;
 // Rest and transport retain this species and its connected body.
 drawWholePose(c,flying?sprite.flightAtlas:sprite.atlas,flying?sprite.flightMeta:sprite.meta,frame,z.x,z.y,spec.height,z.dir);
}
export function drawCaptureResistance(c,z){
 if(!['run','startle','taunt'].includes(z.state)&&!(z.hitDisplay>0))return;
 if(['hooked','caught','boarding','delivered','escaped','escaping','hidden'].includes(z.state))return;
 const spec=speciesFor(z),left=z.resistance+1,y=z.y-spec.height-17;
 c.save();c.fillStyle='#183932d9';c.beginPath();c.roundRect(z.x-22,y-11,44,17,6);c.fill();
 c.fillStyle=z.hitDisplay>0?'#fff089':'#dbe6c4';c.font='bold 12px system-ui';c.textAlign='center';c.fillText(`${left} / ${spec.hits}`,z.x,y+2);c.restore();
}
