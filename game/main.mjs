import {trackGameStart} from './analytics.mjs';
import {preparePauseMenu} from './pause-menu.mjs';
import {installGameGestures} from './game-gestures.mjs';
import {bindTouchControls} from './touch-controls.mjs';
import {currentEater,EAT_SECONDS} from './eating.mjs';
import {loadHunt,loadWorkshop} from './scene-assets.mjs?v=mobile-load-13';
import {PlayerStore,snapshotGame,restoreGame} from './player-store.mjs?v=static-14';
import {RECIPES,drawProduct,productImageSource} from './products.mjs?v=mobile-load-13';
import {SPECIES,speciesFor} from './species.mjs?v=hunter-avoidance-12';
let albumActionStart=0;
import {compressionPose} from './compression.mjs?v=hunt-fixes-7';
import {shopSupply} from './shop.mjs?v=mobile-load-13';
import {SimulationClock} from './motion.mjs?v=hunt-fixes-7';
import {emergencePose,drawBurrow} from './emergence.mjs?v=hunt-fixes-7';
import {Laboratory,renderLab} from './lab.mjs?v=mobile-load-13';
import {drawHunter,drawDog,drawPrey,drawCaptureResistance} from './character-rigs.mjs?v=mobile-load-13';
import {drawRecoveryCraft,drawCaptureBalloon,drawHarpoon} from './recovery-render.mjs?v=mobile-load-13';
import {Game,WORLD,PONDS,PLATFORMS,LAND,groundAt,CAPTURE_STATES} from './engine.mjs?v=hunter-avoidance-12';
import {AudioEngine} from './audio.mjs?v=hit-voices-8';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const canvas=$('#game'),c=canvas.getContext('2d'),preview=$('#preview'),pc=preview.getContext('2d');
window.naiwaLoader?.moduleReady();
const pauseMenuReady=preparePauseMenu($('#pauseMenuArt'),$('.pause-art-panel'));
const images={};let assetsLoaded=false,loadGeneration=0;
function load(){const generation=++loadGeneration;return loadHunt(images,(done,total)=>{if(generation!==loadGeneration)return;window.naiwaLoader?.progress(done,total);$('#saveStatus').textContent=`正在准备捕猎素材 ${Math.round(done/total*100)}%`;});}
// Hunt artwork takes priority; workshop art warms immediately after the hunt is ready.
let huntLoad=load();huntLoad.catch(()=>{});
const playerStore=new PlayerStore();
const initialSave=await playerStore.init();
if(navigator.locks){
 const ownsSave=await new Promise(resolve=>{navigator.locks.request('peach-catcher-progress',{ifAvailable:true},async lock=>{resolve(!!lock);if(lock)await new Promise(()=>{});});});
 if(!ownsSave){playerStore.pending=false;playerStore.conflict=true;document.querySelector('.intro-copy').innerHTML='<h1>游戏已在另一页打开</h1><p>为保护你的进度，请先关闭另一个游戏页面，再刷新这一页继续。</p><button class="primary" id="reloadGame">重新读取存档</button>';document.querySelector('#reloadGame').onclick=()=>location.reload();await new Promise(()=>{});}
}

let savedRound=initialSave?.round||null,currentRound=null,roundHistory=initialSave?.history||[],saveTick=0;
const audio=new AudioEngine();let running=false,paused=false,cam=0,last=0,shake=0,toastTimer=0,actor='creature',action='walk',bank=0,level=0,scene='hunt',labRefresh=0,labData={};let labFloor=0;
const simulation=new SimulationClock();const labSoundState=[];let nextChatter=0;
const input={left:false,right:false,jump:false},particles=[],catchLabels=[];let autoplay=false,renderDt=1/60;const pulses={left:0,right:0,jump:0};
try{const v=initialSave||{};bank=Math.max(0,Number(v.bank)||0);level=Math.max(0,Math.min(3,Number(v.level)||0));labData=v.lab||{};}catch{}
const lab=new Laboratory(labData),lc=$('#labCanvas').getContext('2d');
function roundRecord(status='playing',state=game,meta=currentRound){return meta?{id:meta.id,status,duration:state.time,caught:state.caught,delivered:state.delivered,escaped:state.escaped,total:state.prey.length,demo:!!meta.demo}:null;}
function rememberRound(status,state=game,meta=currentRound){const record=roundRecord(status,state,meta);if(!record)return;playerStore.recordRound(record);if(status!=='playing'){roundHistory=[{...record,endedAt:Date.now()},...roundHistory.filter(r=>r.id!==record.id)].slice(0,100);}}
function save(){if(playerStore.conflict)return;const active=running&&!game.finished&&currentRound?{...currentRound,game:snapshotGame(game)}:savedRound;playerStore.save({bank,level,lab:lab.serialize(),round:active,history:roundHistory,sound:audio.enabled});updateBank();}
playerStore.onStatus=message=>{if(assetsLoaded&&$('#saveStatus'))$('#saveStatus').textContent=message;if(playerStore.conflict){togglePause(true);toast(message);}};
function updateBank(){$('#coins').textContent=bank;$('#levelLabel').textContent=`Lv.${level+1}`;$('#upgradeBtn').textContent=level>=3?'装填速度已升满':`升级装填速度 · ${80+level*40} 金币`;$('#upgradeBtn').disabled=level>=3||bank<80+level*40;}
let toastKind='';
function baitSupplyMessage(){return game.baitSupplySeconds?`黄桃罐头已用完，补给还剩 ${game.baitSupplySeconds} 秒送达`:'黄桃罐头已用完，本关目标已全部处理';}
function toast(s){toastKind='';$('#toast').textContent=s;$('#toast').classList.add('show');toastTimer=3;}
const game=new Game({level,onEvent:e=>{
 audio.play(e.type,e);
 if(e.type==='startle')audio.voice('alert');
 if(e.type==='eatBite'&&Math.abs(e.x-game.player.x)<650){audio.voice('eat',.45);}
 if(e.type==='capture'){burst(e.x,e.y-70,'#ffdd55',18);shake=4;catchLabels.push({x:e.x,y:e.y-135,life:1.2});}
 if(e.type==='resistHit'){burst(e.x,e.y-60,'#ffe79d',7);shake=2;}
 if(e.type==='pickup')toast('运输笼正在回收目标');
 if(e.type==='escapeDive')burst(e.x,e.y,'#a4cfc5',12);
 if(e.type==='land')burst(e.x,e.y-3,'#81977b',5);
 if(e.type==='emergePop')burst(e.x,(groundAt(e.x)??WORLD.floor)-10,'#8caa70',10);
 if(e.type==='fall')toast('掉进沼泽了！按住喷气键跨越水坑');
 if(e.type==='escaped')toast(`目标已逃走 · 本关剩余 ${game.remaining} 只`);
 if(e.type==='dogRepelled'){bank+=e.coins;save();burst(e.x,e.y-35,'#ffe06b',12);toast('小狗退开了 · +10 金币');}
 if(e.type==='hurt'){shake=8;toast(e.source==='dog'?'被小狗撞晕了！跳起躲避，或用鱼叉驱退':'被撞到了，稍等一下！');}
 if(e.type==='complete'){$('#resultTitle').textContent=game.escaped===0?'满载而归！':game.delivered?'本次捕猎结束':'这次都逃走了';$('#resultSummary').textContent=`本关共 ${game.prey.length} 只 · 回收 ${game.delivered} 只 · 逃走 ${game.escaped} 只。${game.delivered?'已回收的角色送入加工库存。':'没有获得加工原料，下次再试。'}`;$('#resultNumber').textContent=game.delivered;lab.addCaptured(game.prey);running=false;savedRound=null;rememberRound('completed');save();$('#resultOverlay').classList.remove('hidden');}
 if(e.type==='baitEmpty'){toast(baitSupplyMessage());toastKind='bait';}
 if(e.type==='resupply')toast('补给送达：黄桃罐头 +2，可以继续投放了');
}});

function round(ctx,x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function ellipse(ctx,x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
function line(ctx,x,y,x2,y2,color,width=2){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x2,y2);ctx.stroke();}
function label(ctx,s,x,y,color='#204b37',size=16){ctx.fillStyle=color;ctx.font=`700 ${size}px "PingFang SC",system-ui`;ctx.textAlign='center';ctx.fillText(s,x,y);}
function burst(x,y,color,n){for(let i=0;i<n;i++)particles.push({x,y,vx:(Math.random()-.5)*190,vy:-Math.random()*160,life:.5+Math.random()*.4,color});}
const hunterFrames=[[0,0,452,438],[435,0,451,438],[834,0,489,437],[1285,0,478,438],[0,436,451,439],[450,429,447,446],[918,416,427,386],[1360,470,409,407]];
function sprite(ctx,name,frame,x,y,height,dir=1){
 const im=images[name];if(!im)return;let sx,sy,sw,sh;
 if(name==='hunter'){[sx,sy,sw,sh]=hunterFrames[frame%8];}
 else if(name==='hunterRun'||name==='preyRun'){sw=im.width/3;sh=im.height/2;sx=frame%3*sw;sy=Math.floor(frame/3)*sh;}
 else{sw=im.width/4;sh=im.height/2;sx=(frame%4)*sw;sy=Math.floor(frame/4)*sh;}
 const dw=height*sw/sh;ctx.save();ctx.translate(x,y);ctx.scale(dir*(name==='hunter'||name==='hunterRun'||name==='preyRun'?1:-1),1);
 ctx.drawImage(im,sx,sy,sw,sh,-dw*(name.startsWith('hunter')?.38:.5),-height,dw,height);ctx.restore();
}
function inView(x,pad=180){return x+pad>=cam&&x-pad<=cam+1280;}
function ground(x,y,w,depth=720){
 if(x+w<cam-40||x>cam+1320)return;
 c.fillStyle='#111216';c.fillRect(x,y,w,depth);c.fillStyle='#21453f';c.beginPath();c.moveTo(x,y-9);
 for(let i=0;i<=w;i+=18)c.lineTo(x+i,y-7+Math.sin(i*.11)*2);
 c.lineTo(x+w,y+9);for(let i=w;i>=0;i-=18)c.lineTo(x+i,y+10+Math.sin(i*.2)*6);c.closePath();c.fill();
 line(c,x,y-8,x+w,y-8,'#315c4d',3);
 for(let n=19;n<w;n+=83){const len=12+(n%29);round(c,x+n,y+7,5,len,3,'#25473c');ellipse(c,x+n+9,y+len,3,7,'#203c33');}
}
// Plants use world coordinates, so they stay planted as the camera follows the hunter.
function grass(x,y,size=1,seed=0,front=false){
 if(!inView(x,140))return;
 c.save();c.translate(x,y-6);c.scale(size,size);
 const sway=Math.sin(game.time*1.4+seed)*2;
 // Broad, overlapping swamp leaves, with a darker body and olive growing tips.
 for(let i=0;i<13;i++){
  const k=(i*7+seed*3)%17,root=(i-6)*5,tip=root+(i-6)*5+sway,h=20+k*2.5;
  c.fillStyle=front?['#315c3c','#477844','#3b6a40'][i%3]:['#315f46','#47794b','#55834c'][i%3];
  c.beginPath();c.moveTo(root-6,5);c.bezierCurveTo(root-13,-h*.4,tip-9,-h*.85,tip,-h);
  c.bezierCurveTo(tip-1,-h*.48,root+9,-h*.26,root+7,5);c.closePath();c.fill();
  if(i%3===0)line(c,root,0,tip,-h*.77,front?'#57824a':'#669154',1.5);
 }
 ellipse(c,0,2,42,7,front?'#2d563b':'#335e43');
 c.restore();
}
function boundaryShrub(x,y,flip=1){
 if(!inView(x,140))return;
 c.save();c.translate(x,y);c.scale(flip,1);
 line(c,0,-8,-12,-139,'#3b5140',7);line(c,-10,-75,29,-126,'#3b5140',5);
 const clusters=[[-25,-130,31,28],[16,-155,34,30],[34,-109,29,32],[-18,-72,40,29],[25,-39,36,26]];
 for(const [px,py,rx,ry] of clusters){
  ellipse(c,px,py,rx,ry,'#366645');ellipse(c,px-5,py-9,rx*.78,ry*.66,'#4c8147');
  ellipse(c,px-11,py-18,rx*.38,ry*.22,'#6b994b');
  round(c,px+8,py-15,4,22,2,'#648e47');
 }
 c.restore();grass(x,y,1.25,7,true);
}
function stump(x,y){
 if(!inView(x,60))return;
 c.fillStyle='#3f5650';c.beginPath();c.moveTo(x-34,y);c.lineTo(x-27,y-55);c.lineTo(x-15,y-62);c.lineTo(x+29,y-57);c.lineTo(x+24,y-16);c.lineTo(x+39,y);c.closePath();c.fill();
 ellipse(c,x,y-58,28,7,'#637267');ellipse(c,x,y-58,20,4,'#3b5048');line(c,x-9,y-46,x-15,y-5,'#263e37',3);line(c,x+15,y-40,x+13,y-14,'#2b4139',3);
 c.fillStyle='#3f704b';c.beginPath();c.moveTo(x-29,y-60);c.bezierCurveTo(x-5,y-68,x+20,y-66,x+30,y-57);c.lineTo(x+28,y-48);c.lineTo(x+10,y-50);c.lineTo(x+9,y-36);c.lineTo(x+3,y-39);c.lineTo(x+2,y-53);c.lineTo(x-30,y-51);c.closePath();c.fill();
}
function can(x,y){c.save();c.translate(x,y);round(c,-14,-35,28,34,4,'#efd13e');round(c,-8,-31,16,25,1,'#277447');ellipse(c,0,-35,14,4,'#d6dbca');ellipse(c,0,-35,11,2,'#748a7c');ellipse(c,0,-1,14,3,'#bec8b6');label(c,'桃',0,-13,'#fff0bd',14);c.restore();}
function render(t){
 c.clearRect(0,0,1280,720);if(!images.bg)return;
 const p=game.player,desired=Math.max(0,Math.min(WORLD.width-1280,p.x-440));cam+=(desired-cam)*(1-Math.exp(-10*renderDt));
 c.drawImage(images.bg,-cam*.08,-58,1280+(WORLD.width-1280)*.08,810);
 c.save();c.translate(-cam+(Math.random()-.5)*shake,(Math.random()-.5)*shake*.3);
 // A separate collision surface lets the hunter really fall and jet across gaps.
 for(let i=0;i<LAND.length-1;i++){const a=LAND[i],b=LAND[i+1];if(b.x<cam||a.end>cam+1280)continue;const g=c.createLinearGradient(0,450,0,720);g.addColorStop(0,'#20202d');g.addColorStop(1,'#11111c');c.fillStyle=g;c.fillRect(a.end,450,b.x-a.end,270);ellipse(c,(a.end+b.x)/2,483,(b.x-a.end)/2,13,'#222333');line(c,a.end+10,487,b.x-10,487,'#343342',3);}
 for(const land of LAND)ground(land.x,land.y,land.end-land.x);
 for(const s of PLATFORMS){ground(s.x,s.y,s.w,720);}
 for(const [i,land] of LAND.entries()){
  for(let x=land.x+55;x<land.end-25;x+=185)grass(x,land.y,.45+(Math.floor(x/185)%3)*.14,i+Math.floor(x/185));
  boundaryShrub(land.x+28,land.y);boundaryShrub(land.end-28,land.y,-1);
  for(const x of [land.x+300,land.end-275])stump(x,land.y);
 }
 for(const platform of PLATFORMS){grass(platform.x+26,platform.y,.45,3);grass(platform.x+platform.w-22,platform.y,.5,9);}
 for(const z of game.prey)if(inView(z.home))drawBurrow(c,z,groundAt(z.home),t);
 for(const b of game.baits)if(b.life>0&&inView(b.x)&&!currentEater(b,game.prey))can(b.x,b.y);
 for(const z of game.prey){
  if(!inView(z.x,250)||['hidden','escaped','delivered'].includes(z.state))continue;
  let sheet='walk',f=0,y=z.y,h=116;
  if(z.state==='run'){sheet=images.preyRun?'preyRun':'run';f=Math.floor(z.stride/22)%(sheet==='preyRun'?6:8);y+=Math.sin(z.stride/22*Math.PI/3)*2;}
  if(z.state==='walk')f=Math.floor(z.stride/13)%8;
  if(z.state==='eat'){sheet='eat';f=Math.floor(z.anim*6)%8;}
  if(z.state==='startle'){sheet='startle';f=Math.max(0,Math.min(7,Math.floor(z.timer*20)));}
  if(CAPTURE_STATES.includes(z.state)){sheet='startle';f=4+Math.floor(t*8)%4;drawCaptureBalloon(c,z,t);}
  if(z.state==='escaping'){c.save();c.beginPath();c.rect(z.x-160,z.escapeFloor-300,320,301);c.clip();drawPrey(c,images.preyRig,{...z,state:'run'},t);c.restore();continue;}
  if(z.state==='emerging'){const pose=emergencePose(z.timer);c.save();c.beginPath();c.rect(z.x-140,z.y-190,280,191);c.clip();c.translate(z.x,z.y+pose.offset);c.rotate(pose.tilt);c.scale(pose.sx,pose.sy);drawPrey(c,images.preyRig,{...z,x:0,y:0,state:'idle'},t);c.restore();continue;}
  if(z.state==='notice'){f=0;y-=Math.sin(Math.min(1,z.timer/.38)*Math.PI)*3;}
  if(!CAPTURE_STATES.includes(z.state))ellipse(c,z.x,groundAt(z.x)??WORLD.floor,29,5,'#0f252b55');
  if(z.state==='boarding')h*=1-Math.min(1,z.timer/.85)*.4;
  if(z.state==='boarding'){/* Draw inside the transport cage below. */}
  else if(CAPTURE_STATES.includes(z.state)){c.save();c.translate(z.x,y-h/2);c.rotate(Math.sin(t*7+z.id)*.09);if(z.species!=='basic')drawPrey(c,images.preyRig,{...z,x:0,y:h/2},t);else sprite(c,sheet,f,0,h/2,h,z.dir);c.restore();}
  else if(z.species!=='basic'||['run','walk','idle','notice','startle','taunt','eat'].includes(z.state))drawPrey(c,images.preyRig,z,t);
  else sprite(c,sheet,f,z.x,y,h,z.dir);
  if(z.state==='eat'){
   const food=game.baits.find(b=>b.eaterId===z.id&&b.life>0);
   if(food){round(c,z.x-19,z.y+9,38,5,2,'#123a31');round(c,z.x-18,z.y+10,36*(1-(food.eaten||0)/EAT_SECONDS),3,1,'#ffda68');}
  }
  drawCaptureResistance(c,z);
  if(z.state==='startle'){c.font='900 40px Impact,system-ui';c.textAlign='center';c.lineWidth=5;c.strokeStyle='#332819';c.strokeText('!',z.x,z.y-h-8);c.fillStyle='#ff6425';c.fillText('!',z.x,z.y-h-8);}
 }
 for(const d of game.dogs)if(d.state!=='cleared'&&inView(d.x)){ellipse(c,d.x,d.y,29,5,'#10252a66');drawDog(c,images.dogRig,d,t);}
 drawRecoveryCraft(c,game.ship,t,(x,y)=>{const z=game.prey[game.ship.target];if(!z)return;
  const cargoY=game.ship.load?y:z.y-game.ship.y,height=game.ship.load?72:116*(1-Math.min(1,z.timer/.85)*.4);
  if(game.ship.load||z.state==='boarding'){if(z.species==='basic')sprite(c,'startle',6,x,cargoY,height,z.dir);else{const scale=height/Math.max(118,speciesFor(z).height);c.save();c.translate(x,cargoY);c.scale(scale,scale);drawPrey(c,images.preyRig,{...z,x:0,y:0},t);c.restore();}}
 });
 const groundY=groundAt(p.x);if(groundY!==null)ellipse(c,p.x,groundY-1,28,5,'#101b2644');
 if(p.jet){for(let i=0;i<5;i++)ellipse(c,p.x-27*p.dir+(Math.random()-.5)*5,p.y-40+i*8,8-i,10,i<2?'#ecfaff':'#699dff99');}
 drawHunter(c,images.hunterRig,p,game.time);
 if(p.stun)for(let i=0;i<3;i++)label(c,'✦',p.x+Math.cos(t*6+i*2.1)*20,p.y-139+Math.sin(t*6+i*2.1)*5,'#ffe76b',16);
 for(const s of game.shots)drawHarpoon(c,s,p,t);
 if(p.charging){const fill=Math.min(1,p.charge/.85);round(c,p.x-24,p.y-148,48,7,3,'#243a36');round(c,p.x-23,p.y-147,46*fill,5,2,fill===1?'#fff28a':'#a2c969');}
 for(const [i,land] of LAND.entries())for(const x of [land.x+65,land.end-75])grass(x,land.y,.5,i+3,true);
 for(const a of particles){c.globalAlpha=Math.min(1,a.life*2);ellipse(c,a.x,a.y,3,3,a.color);}c.globalAlpha=1;
 for(const a of catchLabels){c.save();c.translate(a.x,a.y);c.rotate(-.06);c.globalAlpha=Math.min(1,a.life*2);c.font='900 43px Impact,Arial';c.textAlign='center';c.lineWidth=6;c.strokeStyle='#101715';c.strokeText('CATCH!',0,0);c.fillStyle='#ffe455';c.fillText('CATCH!',0,0);c.restore();}
 c.restore();
}
function updateHud(){const seconds=game.baitSupplySeconds;const bait=$('[data-action="bait"]');$('#baitSupplyStatus').hidden=!seconds;$('#baitSupplyStatus').textContent=seconds?`补给 ${seconds} 秒`:'';bait.classList.toggle('awaiting-supply',!!seconds);bait.setAttribute('aria-label',seconds?baitSupplyMessage():`投放黄桃罐头，剩余 ${game.baitCount} 罐`);if(toastKind==='bait'&&toastTimer>0)$('#toast').textContent=baitSupplyMessage();$('#huntRemaining').textContent=`剩余 ${game.remaining} · 逃走 ${game.escaped}`;$('#score').textContent=`${game.caught} / ${game.prey.length}`;$('#captureFill').style.width=`${game.caught/game.prey.length*100}%`;$('#baitCount').textContent=game.baitCount;$('#fuelFill').style.width=`${game.player.fuel}%`;$('#reload').textContent=game.player.charging?(game.player.charge>=.85?'蓄力完成':'按住蓄力…'):game.shots.length?(game.shots[0].phase==='outbound'?'鱼叉飞行中':game.shots[0].phase==='tethered'?'等待气球接管':'正在收回鱼叉'):game.player.cooldown>0?`装填中 · ${game.player.cooldown.toFixed(1)} 秒`:'按住蓄力';$('#fireButton').classList.toggle('busy',!!game.shots.length||game.player.cooldown>0);$('#fireButton').classList.toggle('reloading',game.player.cooldown>0);$('#fireButton').style.setProperty('--reload-progress',`${(1-game.player.cooldown/(game.player.reloadDuration||1))*100}%`);$('#fireButton').setAttribute('aria-disabled',String(!!game.shots.length||game.player.cooldown>0));$('#fireButton').classList.toggle('charging',game.player.charging);$('#fireButton').style.setProperty('--charge',`${Math.min(1,game.player.charge/.85)*100}%`);}
let touchInput;
function clearInput(){touchInput?.reset();game.cancelCharge();for(const k in input){input[k]=false;pulses[k]=0;}$$('[data-hold]').forEach(b=>b.classList.remove('pressed'));}
function togglePause(force){if(!running||scene!=='hunt')return;paused=force??!paused;clearInput();$('#pauseOverlay').classList.toggle('hidden',!paused);save();}
function setLabFocus(active){for(const el of $('#workshop').parentElement.children)if(el.id!=='workshop')el.inert=active;}
function start(resume=false,demo=false){
 if(playerStore.conflict){toast('另一页已经更新进度，请刷新后继续');return;}
 document.body.classList.add('game-entered');simulation.reset();setLabFocus(false);scene='hunt';$('#workshop').classList.add('hidden');audio.unlock();audio.play('click');
 const restored=resume&&savedRound&&restoreGame(game,savedRound.game);
 if(restored)currentRound={id:savedRound.id,demo:!!savedRound.demo};
 else{if(running&&!game.finished)rememberRound('abandoned');else if(savedRound)rememberRound('abandoned',savedRound.game,savedRound);game.level=level;game.reset();currentRound={id:crypto.randomUUID(),demo};}
 trackGameStart({demo:demo||!!currentRound?.demo});
 savedRound=null;autoplay=demo;cam=Math.max(0,Math.min(WORLD.width-1280,game.player.x-500));particles.length=0;catchLabels.length=0;running=true;paused=false;clearInput();
 for(const id of ['intro','pauseOverlay','resultOverlay','workshop'])$('#'+id).classList.add('hidden');$('#touchControls').classList.remove('hidden');$('#statusBar').classList.remove('hidden');canvas.focus();rememberRound();save();
 toast(restored?'已恢复上次捕猎，继续追捕！':'按住方向键跑动 · 按住上箭头喷气 · K 放罐头 · 按住 J 蓄力、松开发射');
}
$('#demoBtn').onclick=()=>{start(false,true);toast('操作演示中 · 按方向键即可接管');};
$('#startBtn').onclick=()=>start(true);$('#restartBtn').onclick=()=>start(false);$('#resumeBtn').onclick=()=>togglePause(false);$('#pauseBtn').onclick=()=>togglePause();
$('#historyBtn').onclick=()=>{const list=$('#historyList');list.replaceChildren();if(!roundHistory.length){const p=document.createElement('p');p.textContent='还没有完成的捕猎记录。';list.append(p);}for(const r of roundHistory){const p=document.createElement('p');p.textContent=`${new Date(r.endedAt).toLocaleString('zh-CN')} · ${r.status==='completed'?'完成':'重新开局'} · 回收 ${r.delivered}/${r.total} · 逃走 ${r.escaped}${r.demo?' · 演示':''}`;list.append(p);}modal($('#historyDialog'));};
function syncSoundButtons(){
 const status=audio.music?.status,needsTap=!audio.ctx||status==='blocked'||status==='error';
 for(const id of ['soundBtn','labSoundBtn','homeSoundBtn']){const button=$('#'+id);if(!button)continue;button.textContent=!audio.enabled?'声音 · 关':needsTap?'点按开启声音':'声音 · 开';button.setAttribute('aria-label',audio.enabled&&!needsTap?'关闭声音':'开启声音');}
}
function toggleSound(){
 const recover=audio.enabled&&(!audio.ctx||['blocked','error'].includes(audio.music?.status));
 if(!recover)audio.enabled=!audio.enabled;if(audio.enabled)audio.unlock();audio.musicTick(!document.hidden);syncSoundButtons();audio.play('click');save();
}
audio.onMusicStatus=syncSoundButtons;
$('#soundBtn').onclick=$('#labSoundBtn').onclick=$('#homeSoundBtn').onclick=toggleSound;
function modal(el){clearInput();if(running)paused=true;el.showModal();audio.unlock();audio.play('click');}
$('#weaponBtn').onclick=()=>modal($('#weaponDialog'));$('#albumBtn').onclick=()=>modal($('#albumDialog'));
for(const b of $$('[data-close]'))b.onclick=()=>b.closest('dialog').close();
for(const d of $$('dialog'))d.addEventListener('close',()=>{if(scene==='hunt'){if(running&&$('#pauseOverlay').classList.contains('hidden'))paused=false;canvas.focus();}else if(d.id==='recipeDialog')$('#changeRecipe'+recipeTarget).focus();else $('#productsBtn').focus();});
function makeButtons(){const names=actor==='hunter'?{idle:'持枪待机',run:'持枪奔跑',shoot:'发射后坐',jet:'喷气飞行',stun:'受击'}:actor==='creature'?{walk:'走路',run:'奔跑',eat:'吃罐头',startle:'受惊',taunt:'捧腹大笑'}:{idle:'站立',run:actor==='bird'?'飞行':'奔跑',eat:'吃罐头',caught:'气球接管',taunt:'边笑边走'};if(!names[action])action=actor==='creature'?'walk':'idle';$('#animationButtons').replaceChildren(...Object.entries(names).map(([id,title])=>{const b=document.createElement('button');b.textContent=title;b.classList.toggle('selected',id===action);b.onclick=async()=>{if(id==='taunt')await audio.unlock();action=id;albumActionStart=performance.now();if(id==='taunt')audio.play('taunt');makeButtons();};return b;}));}
for(const b of $$('[data-actor]'))b.onclick=()=>{actor=b.dataset.actor;$$('[data-actor]').forEach(x=>x.classList.toggle('selected',x===b));makeButtons();};
for(const b of $$('[data-hit-voice]'))b.onclick=async()=>{await audio.unlock();audio.play('preyHit',{species:b.dataset.hitVoice});};
for(const b of $$('[data-sfx]'))b.onclick=async()=>{await audio.unlock();audio.play(b.dataset.sfx);};
for(const art of $$('.machine-product img')){art.addEventListener('error',()=>art.classList.add('art-unavailable'));art.addEventListener('load',()=>art.classList.remove('art-unavailable'));}
let workshopAssetState='idle';
function prepareWorkshopArt(){
 if(workshopAssetState==='loading'||workshopAssetState==='ready')return;
 workshopAssetState='loading';$('#productsBtn').disabled=true;$('#workshop').classList.add('art-loading');$('#workshopAssetNotice').hidden=false;$('#workshopAssetMessage').textContent='正在准备工坊画面…';$('#retryWorkshopArt').hidden=true;
 loadWorkshop(images).then(()=>{workshopAssetState='ready';$('#productsBtn').disabled=false;$('#workshop').classList.remove('art-loading');for(let i=0;i<2;i++)$('#productArt'+i).src=productImageSource(lab.recipe(labFloor*2+i).id);$('#workshopAssetNotice').hidden=true;}).catch(()=>{
  workshopAssetState='error';$('#workshopAssetMessage').textContent='工坊画面连接较慢，请重试；进度已保留';$('#retryWorkshopArt').hidden=false;
 });
}
function openLab(){
 document.body.classList.add('game-entered');$('#intro').classList.add('hidden');setLabFocus(true);clearInput();paused=true;scene='lab';$('#workshop').classList.remove('hidden');$('#resultOverlay').classList.add('hidden');$('#pauseOverlay').classList.add('hidden');showLab(false);$('#labTab').focus();audio.unlock();prepareWorkshopArt();
}
$('#retryWorkshopArt').onclick=prepareWorkshopArt;

function showLab(shop){scene=shop?'shop':'lab';$('#workshop').classList.toggle('is-shop',shop);$('#labStatus').classList.toggle('hidden',shop);$('#labTab').classList.toggle('selected',!shop);$('#shopTab').classList.toggle('selected',shop);$('#machineControls').classList.toggle('hidden',shop);$('#labFloors').classList.toggle('hidden',shop);$('#shopActions').classList.toggle('hidden',!shop);updateLab();}
function updateLab(){
 $('#labStatus').textContent=lab.machines.some(m=>m.ends)?'加工进行中 · 返回捕猎后也会继续生产':lab.stock?'选择设备装料，完成后自动送往地面店铺。':'先去捕猎，把回收的角色送进库存。';
 const supply=shopSupply(lab,Date.now()),shopText=`${supply.title}，${supply.detail}，累计售出 ${lab.sales} 份，可收取 ${lab.cash} 金币`;if($('#shopStatus').textContent!==shopText)$('#shopStatus').textContent=shopText;
 $('#labCoins').textContent=`金币 ${bank}`;$('#stockLabel').textContent=`角色库存 ${lab.stock}`;$('#cupsLabel').textContent=`成品库存 ${lab.cups}`;
 $('#upgradeBtn').textContent=level>=3?'装填速度已升满':`升级装填速度 · ${80+level*40} 金币`;$('#upgradeBtn').disabled=level>=3||bank<80+level*40;
 $('#collectBtn').textContent=`收取营业收入 · ${lab.cash}`;$('#collectBtn').disabled=!lab.cash;
 for(let i=0;i<2;i++){const idx=labFloor*2+i,m=lab.machines[idx];
  const r=lab.recipe(idx),select=$('#recipe'+i);select.value=m.recipeId;
  const art=$('#productArt'+i);if(workshopAssetState==='ready'&&art.getAttribute('src')!==productImageSource(r.id))art.src=productImageSource(r.id);art.alt=r.name;
  $('#productName'+i).textContent=r.name;$('#machineLabel'+i).textContent=`设备 ${idx+1} · ${m.unlocked?'Lv.'+(m.level+1):'未购置'}`;
  $('#recipeSummary'+i).textContent=`${r.ingredient} ${r.cost} 只 → ${r.cups} 份 · ${Math.round(r.seconds/(1+m.level*.3))} 秒`;
  $('#ingredientStatus'+i).textContent=m.ends?'加工中 · 完成后自动送往店铺':`可用原料 ${lab.stocks[r.species]} 只${lab.stocks[r.species]<r.cost?' · 原料不足':''}`;
  $('#changeRecipe'+i).disabled=!m.unlocked||!!m.ends;select.disabled=!m.unlocked||!!m.ends;
  for(const option of select.options){const product=RECIPES.find(r=>r.id===option.value);option.textContent=`${product.name} · ${product.ingredient} ${lab.stocks[product.species]}/${product.cost}`;}
  const b=$('#machine'+i),u=$('#upgradeMachine'+i),remain=Math.max(0,Math.ceil((m.ends-Date.now())/1000));
  b.textContent=!m.unlocked?`购置压榨机 · ${lab.unlockCost(idx)} 金币`:m.ends?`生产中 · ${remain} 秒`:lab.stocks[r.species]<r.cost?`缺少${r.ingredient} · 还需 ${r.cost-lab.stocks[r.species]} 只`:`▶ 开始生产`;
  b.disabled=!m.unlocked?bank<lab.unlockCost(idx):!!m.ends||lab.stocks[r.species]<r.cost;
  u.textContent=m.level>=3?'设备已升满':`提升速度 ↗  ${lab.upgradeCost(idx)} 金币`;
  u.classList.toggle('hidden',!m.unlocked);u.disabled=!m.unlocked||m.level>=3||bank<lab.upgradeCost(idx);
 }
 $('#floorLabel strong').textContent=`B${labFloor+1}`;$('#floorLabel span').textContent=`地下 ${labFloor+1} / ${lab.floorCount} 层`;$('#floorPrev').disabled=labFloor===0;$('#floorNext').disabled=labFloor===lab.floorCount-1;$('#expandFloor').textContent=`扩建 B${lab.floorCount+1} · ${lab.expansionCost()} 金币`;$('#expandFloor').disabled=bank<lab.expansionCost();$('#floorHint').textContent=bank<lab.expansionCost()?`还差 ${lab.expansionCost()-bank} 金币 · 含一台设备`:'扩建附送一台设备';
}
for(let i=0;i<2;i++){
 const select=$('#recipe'+i);for(const r of RECIPES){const o=document.createElement('option');o.value=r.id;o.textContent=r.name;select.append(o);}
 select.onchange=()=>{if(lab.selectRecipe(labFloor*2+i,select.value)){save();audio.play('click');}updateLab();};
}
let recipeTarget=0;
for(let i=0;i<2;i++)$('#changeRecipe'+i).onclick=()=>{
 recipeTarget=i;
 const idx=labFloor*2+i;$('#recipeDialogTitle').textContent=`设备 ${idx+1} · 选择产品`;
 const list=$('#recipeChoices');list.replaceChildren();
 for(const r of RECIPES){const b=document.createElement('button');b.className='recipe-choice';b.classList.toggle('selected',lab.machines[idx].recipeId===r.id);
 b.innerHTML=`<img src="${productImageSource(r.id)}" alt=""><b>${r.name}</b><span>${r.ingredient} ${r.cost} 只 → ${r.cups} 份</span><small>库存 ${lab.stocks[r.species]} 只 · ${lab.stocks[r.species]>=r.cost?'可以生产':'原料不足'}</small>`;
 b.onclick=()=>{if(lab.selectRecipe(idx,r.id)){save();updateLab();audio.play('click');}$('#recipeDialog').close();$('#changeRecipe'+i).focus();};list.append(b);}
 $('#recipeDialog').showModal();
};
$('#productsBtn').onclick=()=>{const list=$('#productList');list.replaceChildren();for(const r of RECIPES){const card=document.createElement('article'),icon=document.createElement('img');icon.src=productImageSource(r.id);icon.alt=r.name;icon.width=220;icon.height=220;const title=document.createElement('h3');title.textContent=r.name;const detail=document.createElement('p');detail.textContent=`${r.ingredient} ${r.cost} 只 → ${r.cups} 份 · ${r.seconds} 秒 · 单价 ${r.price} 金币`;const stock=document.createElement('b');stock.textContent=`原料 ${lab.stocks[r.species]} 只 / 成品 ${lab.products[r.id]} 份`;card.append(icon,title,detail,stock);list.append(card);}$('#productsDialog').showModal();};
$('#closeProducts').onclick=()=>$('#productsDialog').close();
$('#processBtn').onclick=openLab;$('#openLabPause').onclick=openLab;$('#openLabIntro').onclick=openLab;
$('#labTab').onclick=$('#toLabBtn').onclick=()=>showLab(false);$('#shopTab').onclick=()=>showLab(true);
$('#floorPrev').onclick=()=>{labFloor=Math.max(0,labFloor-1);updateLab();audio.play('click');};
$('#floorNext').onclick=()=>{labFloor=Math.min(lab.floorCount-1,labFloor+1);updateLab();audio.play('click');};
$('#expandFloor').onclick=()=>{const spent=lab.expand(bank);if(spent){bank-=spent;labFloor=lab.floorCount-1;save();updateLab();audio.play('batchReady');}};
$('#againBtn').onclick=()=>{if(!running||game.finished){start(true);return;}setLabFocus(false);scene='hunt';paused=false;$('#workshop').classList.add('hidden');canvas.focus();};
for(let i=0;i<2;i++){
 $('#machine'+i).onclick=()=>{const idx=labFloor*2+i,m=lab.machines[idx];if(!m.unlocked){const spent=lab.unlock(idx,bank);if(spent)bank-=spent;}
  else if(lab.start(idx,Date.now())){$('#labStatus').textContent='机器正在生产；可以切到店铺，也可以返回捕猎。';audio.play('loadMachine');}
  save();updateLab();};
 $('#upgradeMachine'+i).onclick=()=>{const spent=lab.upgrade(labFloor*2+i,bank);if(spent){bank-=spent;save();updateLab();audio.play('sale');}};
}
$('#collectBtn').onclick=()=>{const earned=lab.collect();if(earned){bank+=earned;save();updateLab();audio.play('sale');$('#labStatus').textContent=`已收取 ${earned} 金币营业收入`;}};
$('#upgradeBtn').onclick=()=>{const cost=80+level*40;if(level<3&&bank>=cost){bank-=cost;level++;game.level=level;save();audio.play('sale');updateLab();$('#labStatus').textContent='捕猎装备装填速度已升级';}};
const keys={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump'};
document.addEventListener('keydown',e=>{
 if(scene!=='hunt'||$$('dialog[open]').length)return;
 if(keys[e.code]||['KeyJ','KeyK','KeyP'].includes(e.code))e.preventDefault();
 if(e.code==='KeyP'&&!e.repeat){togglePause();return;}
 if(!running||paused)return;
 if(keys[e.code]||['KeyJ','KeyK'].includes(e.code))autoplay=false;
 if(keys[e.code])input[keys[e.code]]=true;
 if(e.code==='KeyJ'&&!e.repeat)game.beginCharge();if(e.code==='KeyK'&&!e.repeat)game.dropBait();
});
document.addEventListener('keyup',e=>{if(keys[e.code])input[keys[e.code]]=false;if(e.code==='KeyJ'&&running&&!paused)game.releaseCharge();});
window.addEventListener('blur',()=>{clearInput();if(running)togglePause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)togglePause(true);});
installGameGestures($('.game-shell'),{isPlaying:()=>running&&!paused&&scene==='hunt'});
touchInput=bindTouchControls($('#touchControls'),{
 isActive:()=>running&&!paused&&scene==='hunt',
 onInteract:()=>{autoplay=false;canvas.focus({preventScroll:true});audio.unlock();},
 onHold:(key,held)=>{input[key]=held;},
 onTapPulse:(key,duration)=>{pulses[key]=duration;},
 onBeginFire:()=>game.beginCharge(),onReleaseFire:()=>game.releaseCharge(),onCancelFire:()=>game.cancelCharge(),
 onBait:()=>game.dropBait()
});
let hudTick=0,labTick=0;
function frame(ms){
 if(document.hidden){last=ms;audio.musicTick(false);requestAnimationFrame(frame);return;}
 audio.musicTick(!document.hidden);
 const dt=Math.min(.12,(ms-last)/1000||0);last=ms;renderDt=dt;
 if(running&&!paused&&scene==='hunt'){
  simulation.advance(dt,step=>{
  if(autoplay){
   const z=game.prey.find(z=>z.state!=='escaped'&&!CAPTURE_STATES.includes(z.state));clearInput();
   if(z){const target=['hidden','emerging'].includes(z.state)?z.home-305:z.x-210;input.right=game.player.x<target-6;input.left=game.player.x>target+6;
    const dir=input.right?1:input.left?-1:game.player.dir;
    if(groundAt(game.player.x+dir*85)===null||groundAt(game.player.x)===null||PLATFORMS.some(s=>game.player.y>s.y-15&&game.player.x+dir*90>s.x&&game.player.x+dir*90<s.x+s.w))input.jump=true;
    if(z.state==='hidden'&&Math.abs(game.player.x-(z.home-305))<20){game.player.dir=1;if(!game.baits.some(b=>Math.abs(b.x-z.home)<330))game.dropBait();}
    if(z.species==='bird'&&z.flying&&game.player.y>z.y+20)input.jump=true;
    if(!['hidden','emerging'].includes(z.state)&&Math.abs(z.x-game.player.x)<330&&Math.abs(z.y-game.player.y)<36){game.player.dir=Math.sign(z.x-game.player.x)||1;game.fire();}
   }
   const dog=game.dogs.find(d=>!['cleared','retreat'].includes(d.state)&&Math.abs(d.x-game.player.x)<180);
   if(dog){game.player.dir=Math.sign(dog.x-game.player.x)||1;game.fire();if(Math.abs(dog.x-game.player.x)<105)input.jump=true;}
  }
  const live={...input};for(const key in pulses){if(pulses[key]>0){live[key]=true;pulses[key]-=step;}}
  game.update(step,live);});if(game.player.vx&&game.player.grounded)audio.play('step');if(game.player.jet)audio.play('jet');if(['approach','depart'].includes(game.ship.phase))audio.play('shipEngine');if(game.time>nextChatter){const z=game.prey.find(z=>['idle','walk','run'].includes(z.state)&&Math.abs(z.x-game.player.x)<500);if(z){audio.voice('curious',.65);nextChatter=game.time+4.5;}else nextChatter=game.time+1;}if((hudTick+=dt)>=1/15){hudTick=0;updateHud();}}else simulation.reset();
 const t=game.time;
 const now=Date.now();for(let i=0;scene==='lab'&&i<lab.machines.length;i++){const pose=compressionPose(lab.machines[i],now),stamp=pose.active?`${lab.machines[i].ends}:${pose.cycle}:${pose.stage}`:'idle';if(scene==='lab'&&Math.floor(i/2)===labFloor&&labSoundState[i]!==stamp){if(pose.stage==='液压下压')audio.play('pressDown');if(pose.stage==='挤压出汁')audio.play('squeeze');if(pose.stage==='压板回升')audio.play('pressUp');if(pose.stage==='输送饮品')audio.play('juiceFlow');if(stamp==='idle'&&labSoundState[i]&&labSoundState[i]!=='idle')audio.play('batchReady');}labSoundState[i]=stamp;}
 const previousSales=lab.sales;labTick+=dt;if(labTick>=.25&&!playerStore.conflict&&lab.advance(Date.now())){save();if(scene!=='hunt')updateLab();if(scene==='shop'&&lab.sales>previousSales)audio.play('sale');}
 if(labTick>=.25)labTick=0;
 if(scene!=='hunt'&&(labRefresh-=dt)<=0){labRefresh=.25;updateLab();}
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('#toast').classList.remove('show');}shake*=.88;
 if(!paused){for(const a of particles){a.x+=a.vx*dt;a.y+=a.vy*dt;a.vy+=250*dt;a.life-=dt;}for(let i=particles.length-1;i>=0;i--)if(particles[i].life<=0)particles.splice(i,1);}
 for(const a of catchLabels){a.life-=dt;a.y-=dt*25;}while(catchLabels.length&&catchLabels[0].life<=0)catchLabels.shift();
 if(scene==='hunt'){if(assetsLoaded&&running&&!paused)render(t);}else renderLab(lc,lab,ms/1000,(x,y,h,species='basic')=>{lc.save();lc.translate(x,y);const size=speciesFor({species}).height;lc.scale(h/size,h/size);drawPrey(lc,images.preyRig,{species,x:0,y:0,dir:1,state:'idle',stride:0},ms/1000);lc.restore();},scene==='shop',images,labFloor);
 if($('#albumDialog').open){pc.clearRect(0,0,800,380);ellipse(pc,400,341,100,11,'#3352381b');if(actor==='hunter'){const f=action==='run'?Math.floor(t*10)%6:({idle:4,shoot:5,jet:6,stun:7}[action]);pc.save();pc.translate(370,343);pc.scale(2.2,2.2);drawHunter(pc,images.hunterRig,{x:0,y:0,dir:1,stride:ms/1000*295,grounded:action!=='jet',vx:action==='run'?295:0,shot:action==='shoot'?.1:0,stun:action==='stun'?.5:0},ms/1000);pc.restore();}else{pc.save();pc.translate(400,343);const size=['hopper','bird'].includes(actor)?2:2.5;pc.scale(size,size);drawPrey(pc,images.preyRig,{species:actor==='creature'?'basic':actor,x:0,y:0,dir:1,state:action,flying:actor==='bird'&&action==='run',timer:(ms-albumActionStart)/1000,stride:ms/1000*(action==='run'?250:72),motionSpeed:action==='run'?250:action==='walk'?72:0},ms/1000);pc.restore();}}
 if((saveTick+=dt)>=3){saveTick=0;if(running)rememberRound();save();}
 requestAnimationFrame(frame);
}
makeButtons();updateBank();$('#touchControls').classList.add('hidden');$('#statusBar').classList.add('hidden');requestAnimationFrame(frame);
function finishLoading(promise){Promise.all([promise,pauseMenuReady]).then(()=>{assetsLoaded=true;window.naiwaLoader?.ready();$('#retryAssets').hidden=true;$('#startBtn').setAttribute('aria-label',savedRound?'继续捕猎':'开始捕猎');$('#continueHint').classList.toggle('hidden',!savedRound);$('#startBtn').disabled=false;$('#demoBtn').disabled=false;$('#openLabIntro').disabled=false;$('#saveStatus').textContent=playerStore.ready?'进度保存在此浏览器 · 请勿清除网站数据':'浏览器无法保存进度，请勿关闭页面';render(0);setTimeout(prepareWorkshopArt,300);}).catch(e=>{window.naiwaLoader?.error();$('#saveStatus').textContent='部分素材暂时无法加载，可重试';$('#retryAssets').hidden=false;console.error(e);});}
finishLoading(huntLoad);
$('#retryAssets').onclick=()=>{window.naiwaLoader?.retry();$('#retryAssets').hidden=true;huntLoad=load();finishLoading(huntLoad);};

playerStore.beforeLeave=()=>{save();if(running)rememberRound();};
document.addEventListener('visibilitychange',()=>{if(document.hidden){save();if(running)rememberRound();}});
if(initialSave?.sound===false){audio.enabled=false;$('#soundBtn').textContent=$('#labSoundBtn').textContent='声音 · 关';$('#soundBtn').setAttribute('aria-label','开启声音');$('#labSoundBtn').setAttribute('aria-label','开启声音');}
if(!assetsLoaded)$('#saveStatus').textContent='正在准备捕猎素材…';

// iOS permits playback at the end of a touch; pointerdown alone is not sufficient on every device.
const restoreAudio=event=>{if(event?.target?.closest?.('#soundBtn,#labSoundBtn,#homeSoundBtn'))return;if(audio.enabled)audio.unlock();};
document.addEventListener('pointerup',restoreAudio,{passive:true});
document.addEventListener('touchend',restoreAudio,{passive:true});
document.addEventListener('keydown',restoreAudio,{passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)audio.resume();audio.musicTick(!document.hidden);});

syncSoundButtons();
