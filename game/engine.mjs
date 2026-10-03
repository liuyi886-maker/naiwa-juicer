import {speciesFor,ENCOUNTER_SPECIES,capturePoint,escapeSpeed,birdFlightHeight} from './species.mjs?v=hunter-avoidance-12';
import {TAUNT_DURATION,TAUNT_APPROACH,ESCAPE_JUMP_DURATION,escapeJumpOffset} from './taunt.mjs?v=hunt-fixes-7';
import {approach,updatePose} from './motion.mjs?v=hunt-fixes-7';
import {EMERGE_SECONDS} from './emergence.mjs?v=hunt-fixes-7';
export const BAIT_SUPPLY_SECONDS = 10;
export const HIT_SLOW = {duration:.35,reduction:.25};
export const MUZZLE = {x:79,y:-84};
export const WORLD = { width: 9200, floor: 480, gravity: 1200 };
export const PONDS = [880, 1230, 3110, 3510, 5420, 5810, 7810, 8270];
export const LAND = [{x:0,end:2080,y:480},{x:2260,end:4360,y:450},{x:4540,end:6690,y:480},{x:6880,end:9200,y:435}];
export const groundAt=x=>LAND.find(s=>x>=s.x&&x<=s.end)?.y??null;
export const PLATFORMS = [{x:2305,y:355,w:140},{x:4585,y:380,w:140},{x:6925,y:340,w:140}];
// Feet are the body's origin. These are the exact solid rectangles drawn in main.
export const SOLIDS = [
  ...LAND.map(s=>({x:s.x,y:s.y,w:s.end-s.x,bottom:1200})),
  ...PLATFORMS.map(s=>({...s,bottom:s.y+720})),
];
export const CAPTURE_STATES=['hooked','caught','boarding','delivered'];
const EPS=.001;
export function moveSolid(body,dx,dy,halfWidth,height) {
  const oldX=body.x,oldY=body.y;
  let x=oldX+dx;
  for(const s of SOLIDS){
    if(oldY<=s.y+EPS||oldY-height>=s.bottom-EPS)continue;
    if(dx>0&&oldX+halfWidth<=s.x+EPS&&x+halfWidth>s.x)x=Math.min(x,s.x-halfWidth);
    if(dx<0&&oldX-halfWidth>=s.x+s.w-EPS&&x-halfWidth<s.x+s.w)x=Math.max(x,s.x+s.w+halfWidth);
  }
  body.x=clamp(x,halfWidth,WORLD.width-halfWidth);
  if(Math.abs(body.x-(oldX+dx))>EPS&&'vx' in body)body.vx=0;
  let y=oldY+dy;body.grounded=false;
  for(const s of SOLIDS){
    if(body.x+halfWidth<=s.x+EPS||body.x-halfWidth>=s.x+s.w-EPS)continue;
    if(dy>=0&&oldY<=s.y+EPS&&y>=s.y){y=Math.min(y,s.y);body.vy=0;body.grounded=true;}
    if(dy<0&&oldY-height>=s.bottom-EPS&&y-height<s.bottom){y=Math.max(y,s.bottom+height);body.vy=0;}
  }
  body.y=y;
}
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export class Game {
  constructor({ level=0, onEvent=()=>{} }={}) {
    this.level=level; this.onEvent=onEvent; this.reset();
  }
  reset() {
    this.time=0; this.caught=0; this.escaped=0; this.finished=false; this.baitCount=8;this.baitSupplyRemaining=null;
    this.player={x:190,y:WORLD.floor,vx:0,vy:0,dir:1,fuel:100,grounded:true,stun:0,cooldown:0,shot:0,stride:0,lastSafe:190,charging:false,charge:0,invulnerable:0};
    this.prey=PONDS.map((x,id)=>({id,x,y:groundAt(x),vy:0,grounded:true,stride:0,home:x,state:'hidden',timer:0,dir:-1,anim:0,escapeTime:0,turnLock:0,hitsLanded:0,flying:false,flightTime:0,species:ENCOUNTER_SPECIES[id],resistance:speciesFor({species:ENCOUNTER_SPECIES[id]}).hits-1,hitFlash:0,hitSlow:0}));
    this.dogs=[550,4040,6160,9020].map((x,id)=>({id,x,y:groundAt(x),home:x,dir:id%2?-1:1,state:'patrol',timer:0,stride:0,vy:0,grounded:true}));
    this.delivered=0;this.ship={x:690,y:-180,phase:'standby',target:null,gate:0,load:0,timer:0};
    this.baits=[];this.shots=[];this.events=[];this.baitCooldown=0;this.completeTimer=0;
  }
  get remaining(){return this.prey.length-this.caught-this.escaped;}
  escape(z,reason='exit'){
    if(this.finished||z.state==='escaped'||CAPTURE_STATES.includes(z.state))return false;
    z.state='escaped';z.flying=false;z.timer=0;z.vy=0;z.hitSlow=0;this.escaped++;
    this.emit('escaped',{id:z.id,species:z.species,reason,escaped:this.escaped,remaining:this.remaining});return true;
  }
  emit(type,data={}) { const e={type,...data};this.events.push(e);this.onEvent(e); }
  get baitSupplySeconds(){return !this.finished&&this.remaining>0&&this.baitCount===0?Math.ceil(this.baitSupplyRemaining??BAIT_SUPPLY_SECONDS):0;}
  dropBait() {
    const p=this.player;
    if(this.finished)return false;
    if(this.baitCount<=0){if(this.remaining>0)this.baitSupplyRemaining??=BAIT_SUPPLY_SECONDS;this.emit('baitEmpty',{seconds:this.baitSupplySeconds});return false;}
    if(this.baitCooldown>0||p.stun>0) return false;
    this.baitCount--;this.baitCooldown=.7;
    if(this.baitCount===0&&this.remaining>0)this.baitSupplyRemaining=BAIT_SUPPLY_SECONDS;
    // Start outside the hunter, but sweep the hand-to-release path against walls.
    const bait={x:p.x,y:p.y-55,vx:240*p.dir,vy:-220,life:22,landed:false};
    moveSolid(bait,24*p.dir,0,14,39);
    this.baits.push(bait);
    this.emit('bait');return true;
  }
  beginCharge(){
    const p=this.player;if(this.finished||p.stun>0||p.cooldown>0||this.shots.length)return false;
    p.charging=true;p.charge=0;return true;
  }
  cancelCharge(){this.player.charging=false;this.player.charge=0;}
  releaseCharge(){const p=this.player;if(!p.charging)return false;const power=p.charge;this.cancelCharge();return this.fire(power);}
  fire(charge=0) {
    const p=this.player;
    if(this.finished||p.cooldown>0||p.stun>0||this.shots.length) return false;
    this.cancelCharge();p.shot=.16;
    const muzzle={x:p.x+MUZZLE.x*p.dir,y:p.y+MUZZLE.y};
    const wall=SOLIDS.some(s=>muzzle.y>s.y&&muzzle.y<s.bottom&&Math.max(p.x,muzzle.x)>=s.x&&Math.min(p.x,muzzle.x)<=s.x+s.w);
    this.shots.push({x:wall?p.x:muzzle.x,y:muzzle.y,vx:830*p.dir,dir:p.dir,travel:0,phase:wall?'retract':'outbound',timer:0,target:null,damage:charge>=.85?2:1});
    this.emit('shoot',{charged:charge>=.85});return true;
  }
  capture(z) {
    if(['hidden','emerging','escaping','escaped',...CAPTURE_STATES].includes(z.state)||z.resistance>0)return false;
    z.state='hooked';z.flying=false;z.timer=0;z.vy=0;z.hitSlow=0;z.order=this.caught++;this.emit('capture',{x:z.x,y:z.y,id:z.id});return true;
  }
  hit(z,shot){
    if(['hidden','emerging','escaping','escaped',...CAPTURE_STATES].includes(z.state))return false;
    z.hitsLanded=(z.hitsLanded||0)+1;z.hitDisplay=1.4;
    this.emit('preyHit',{x:z.x,y:z.y,id:z.id,species:z.species});
    if(z.resistance>0){
      const remaining=z.resistance+1,damage=z.hitsLanded===1?Math.min(shot.damage,z.resistance):shot.damage;z.resistance=Math.max(0,z.resistance-damage);z.hitFlash=.2;
      // A charged hook can overcome several resistance points and capture in one shot.
      if(damage>=remaining)return this.capture(z);
      this.emit('resistHit',{x:z.x,y:z.y,id:z.id,species:z.species,remaining:z.resistance+1});
      z.hitSlow=HIT_SLOW.duration;
      // Never freeze, reset a running stride or turn an escaping target toward the hunter.
      if(!['run','taunt'].includes(z.state)){z.state='run';z.timer=0;z.dir=Math.sign(z.x-this.player.x)||z.dir;}
      return false;
    }
    return this.capture(z);
  }
  updateDogs(dt){
    const p=this.player;
    for(const d of this.dogs){
      if(d.state==='cleared')continue;d.timer+=dt;
      const near=Math.abs(p.x-d.x)<190&&Math.abs(p.y-d.y)<95;
      if(d.state==='patrol'&&near){d.state='alert';d.timer=0;d.dir=Math.sign(p.x-d.x)||1;this.emit('bark',{x:d.x});}
      else if(d.state==='alert'&&d.timer>.5){d.state='charge';d.timer=0;}
      else if(d.state==='charge'&&d.timer>.7){d.state='recover';d.timer=0;}
      else if(d.state==='recover'&&d.timer>1.2){d.state='patrol';d.timer=0;}
      else if(d.state==='retreat'&&d.timer>.4){d.state='cleared';continue;}
      const speed=d.state==='charge'?260:d.state==='patrol'?42:d.state==='retreat'?190:0;
      const land=LAND.find(s=>d.home>=s.x&&d.home<=s.end);
      if((d.x<Math.max(land.x+35,d.home-115)&&d.dir<0)||(d.x>Math.min(land.end-35,d.home+115)&&d.dir>0))d.dir*=-1;
      const oldX=d.x;d.vy+=WORLD.gravity*dt;moveSolid(d,d.dir*speed*dt,d.vy*dt,24,70);d.stride+=Math.abs(d.x-oldX);
      if(speed&&Math.abs(d.x-oldX)<.01)d.dir*=-1;
      if(d.state!=='retreat'&&p.invulnerable<=0&&Math.abs(d.x-p.x)<42&&p.y>d.y-68&&p.y-100<d.y){
        p.stun=.9;p.invulnerable=1.8;this.cancelCharge();const dir=Math.sign(p.x-d.x)||d.dir;
        moveSolid(p,dir*30,0,21,105);d.state='recover';d.timer=0;this.emit('hurt',{source:'dog'});
      }
    }
  }
  repelDog(d){
    if(['retreat','cleared'].includes(d.state))return false;
    d.state='retreat';d.timer=0;d.dir=Math.sign(d.x-this.player.x)||1;this.emit('dogRepelled',{x:d.x,y:d.y,coins:10});return true;
  }
  updateHarpoon(dt){
    const p=this.player;
    for(const shot of this.shots){
      shot.timer+=dt;
      if(shot.phase==='tethered'){
        const z=this.prey[shot.target];Object.assign(shot,capturePoint(z));
        if(z.state!=='hooked'){shot.phase='retract';shot.timer=0;this.emit('reel');}
      }else if(shot.phase==='retract'){
        const dx=p.x+MUZZLE.x*p.dir-shot.x,dy=p.y+MUZZLE.y-shot.y,d=Math.hypot(dx,dy),step=650*dt;
        if(d<=step){shot.phase='done';p.reloadDuration=Math.max(.55,.85-this.level*.1);p.cooldown=p.reloadDuration;this.emit('reload');}
        else {shot.x+=dx/d*step;shot.y+=dy/d*step;}
      }else if(shot.phase==='outbound'){
        const old=shot.x,distance=Math.min(Math.abs(shot.vx)*dt,380-shot.travel),end=old+shot.dir*distance;
        const lo=Math.min(old,end),hi=Math.max(old,end),contacts=[];
        for(const wall of SOLIDS)if(shot.y>wall.y&&shot.y<wall.bottom&&wall.x<=hi&&wall.x+wall.w>=lo){const x=shot.dir>0?Math.max(old,wall.x):Math.min(old,wall.x+wall.w);contacts.push({x,wall:true});}
        for(const z of this.prey)if(!['hidden','emerging','escaping','escaped',...CAPTURE_STATES].includes(z.state)&&shot.y>=z.y-speciesFor(z).bodyHeight-5&&shot.y<=z.y-8&&z.x+speciesFor(z).halfWidth>=lo&&z.x-speciesFor(z).halfWidth<=hi)contacts.push({x:shot.dir>0?Math.max(old,z.x-speciesFor(z).halfWidth):Math.min(old,z.x+speciesFor(z).halfWidth),z});
        for(const dog of this.dogs)if(!['retreat','cleared'].includes(dog.state)&&Math.abs(shot.y-(dog.y-42))<=42&&dog.x+30>=lo&&dog.x-30<=hi)contacts.push({x:shot.dir>0?Math.max(old,dog.x-30):Math.min(old,dog.x+30),dog});
        contacts.sort((a,b)=>Math.abs(a.x-old)-Math.abs(b.x-old));const hit=contacts[0];
        shot.x=hit?hit.x:end;shot.travel+=Math.abs(shot.x-old);
        if(hit){
          if(hit.dog)this.repelDog(hit.dog);
          if(hit.z&&this.hit(hit.z,shot)){shot.phase='tethered';shot.target=hit.z.id;}
          else {shot.phase='retract';this.emit('reel');}
          shot.timer=0;
        }else if(shot.travel>=380-EPS){shot.phase='retract';shot.timer=0;this.emit('reel');}
      }
    }
    this.shots=this.shots.filter(s=>s.phase!=='done');
  }
  updateShip(dt){
    const ship=this.ship;ship.timer+=dt;
    const approach=(v,target,speed)=>v+Math.sign(target-v)*Math.min(Math.abs(target-v),speed*dt);
    if(ship.phase==='depart'){
      ship.gate=Math.max(0,ship.gate-dt*3);ship.y-=235*dt;ship.x+=120*dt;
      if(ship.y<-180){ship.phase='standby';ship.target=null;ship.load=0;ship.timer=0;}
      return;
    }
    if(ship.target===null){
      const next=this.prey.filter(z=>['hooked','caught'].includes(z.state)).sort((a,b)=>a.order-b.order)[0];
      if(next){ship.target=next.id;ship.phase='approach';ship.timer=0;}
    }
    if(ship.target===null){
      if(this.delivered+this.escaped===this.prey.length)return;
      ship.x=approach(ship.x,clamp(this.player.x+480,180,WORLD.width-150),370);ship.y=approach(ship.y,64,180);return;
    }
    const z=this.prey[ship.target];
    ship.x=approach(ship.x,z.x,680);ship.y=approach(ship.y,70,220);
    if(ship.phase==='approach'&&Math.abs(ship.x-z.x)<8&&Math.abs(ship.y-70)<4){ship.phase='loading';ship.timer=0;}
    if(ship.phase==='loading'){
      ship.gate=Math.min(1,ship.gate+dt*3);
      if(z.state==='caught'&&z.y<=260&&ship.gate>=.95){z.state='boarding';z.timer=0;z.boardY=z.y;this.emit('pickup',{x:z.x});}
      if(z.state==='boarding'){
        const t=Math.min(1,z.timer/.85);z.x=ship.x;z.y=z.boardY+(ship.y+82-z.boardY)*t;
        if(t===1){z.state='delivered';this.delivered++;ship.load=1;ship.phase='depart';ship.timer=0;this.emit('delivered',{id:z.id});}
      }
    }
  }
  update(delta,input={}) {
    const dt=clamp(delta,0,.04); if(this.finished)return;
    this.time+=dt;this.events=[];const p=this.player;
    p.invulnerable=Math.max(0,p.invulnerable-dt);
    const oldCooldown=p.cooldown;p.stun=Math.max(0,p.stun-dt);p.cooldown=Math.max(0,p.cooldown-dt);if(oldCooldown>0&&p.cooldown===0)this.emit('ready');p.shot=Math.max(0,p.shot-dt);
    this.baitCooldown=Math.max(0,this.baitCooldown-dt);
    if(p.stun>0)this.cancelCharge();else if(p.charging)p.charge=Math.min(1,p.charge+dt);
    const move=p.stun?0:(Number(!!input.right)-Number(!!input.left));
    const wasGrounded=p.grounded,oldVy=p.vy;
    p.vx=p.stun?0:approach(p.vx,move*295,dt*(move?(Math.sign(p.vx)!==move?4800:2800):4600));if(move)p.dir=move;
    const jet=!!input.jump&&p.fuel>0&&p.stun<=0;
    if(jet){p.vy=Math.max(-300,p.vy-2200*dt);p.fuel=Math.max(0,p.fuel-35*dt);p.grounded=false;}
    else p.fuel=Math.min(100,p.fuel+(p.grounded?32:0)*dt);
    p.jet=jet;p.vy+=WORLD.gravity*dt;const prevX=p.x;
    moveSolid(p,p.vx*dt,p.vy*dt,21,105);
    p.stride+=Math.abs(p.x-prevX);updatePose(p,dt,!wasGrounded&&p.grounded&&oldVy>80);
    if(!wasGrounded&&p.grounded&&oldVy>80)this.emit('land',{x:p.x,y:p.y});
    const land=LAND.find(s=>p.x>s.x+45&&p.x<s.end-45);
    if(p.grounded&&land&&p.y===land.y)p.lastSafe=p.x;
    if(p.y>675){p.x=p.lastSafe;p.y=groundAt(p.x)??WORLD.floor;p.vy=0;p.fuel=100;p.stun=.8;this.emit('fall');}
    if(p.y<165){p.y=165;p.vy=Math.max(0,p.vy);}
    for(const b of this.baits){
      b.life-=dt;
      if(!b.landed){
        // Small swept steps handle corners as well as either face of a raised block.
        const steps=Math.max(1,Math.ceil(dt/(1/120))),step=dt/steps;
        for(let n=0;n<steps&&!b.landed;n++){
          const vx=b.vx;b.vy+=WORLD.gravity*step;
          moveSolid(b,vx*step,b.vy*step,14,39);
          if(vx&&b.vx===0){b.vx=-vx*.22;this.emit('baitWall',{x:b.x,y:b.y});}
          if(b.grounded){b.landed=true;b.vx=0;this.emit('baitLand',{x:b.x});}
          if(b.y>650){b.life=0;break;}
        }
      }
    }
    this.baits=this.baits.filter(b=>b.life>0);
    for(const z of this.prey){
      if(z.state==='escaped'||z.state==='delivered')continue;
      z.timer+=dt;z.anim+=dt;z.turnLock=Math.max(0,z.turnLock-dt);if(z.state==='emerging'&&z.timer>=.53&&z.timer-dt<.53)this.emit('emergePop',{x:z.x});z.hitFlash=Math.max(0,z.hitFlash-dt);z.hitDisplay=Math.max(0,(z.hitDisplay||0)-dt);z.hitSlow=Math.max(0,(z.hitSlow||0)-dt);
      const habitat=LAND.find(s=>z.home>=s.x&&z.home<=s.end);
      const b=this.baits.filter(b=>b.landed&&b.x>habitat.x+35&&b.x<habitat.end-35&&Math.abs(b.x-z.home)<320).sort((a,b)=>Math.abs(a.x-z.x)-Math.abs(b.x-z.x))[0];
      const near=Math.abs(p.x-z.x)<330&&Math.abs(p.y-z.y)<190;const oldX=z.x;
      // Fear follows the hunter's position, including an airborne interception.
      // A body-width dead zone and short turn lock prevent close-range flip-flopping.
      if(['startle','run','taunt'].includes(z.state)&&z.turnLock===0&&
         (p.x-z.x)*z.dir>65&&Math.abs(p.x-z.x)<330&&Math.abs(p.y-z.y)<360){
        z.dir*=-1;z.turnLock=.35;z.escapeTime=0;
        if(z.state==='taunt'){
          z.state='run';z.timer=0;delete z.tauntExit;delete z.tauntDuration;
          delete z.tauntSpeed;delete z.escapeFloor;z.flightLanding=false;
        }
      }
      if(z.state==='hidden'&&b){z.state='emerging';z.timer=0;this.emit('emerge',{x:z.x});}
      else if(z.state==='emerging'&&z.timer>EMERGE_SECONDS){z.state='notice';z.timer=0;}
      else if(z.state==='notice'&&z.timer>.38){z.state='walk';z.timer=0;}
      else if(['idle','walk','eat'].includes(z.state)){
        if(near){z.state='startle';z.timer=0;z.dir=Math.sign(z.x-p.x)||1;this.emit('startle',{x:z.x});}
        else if(b){
          const d=b.x-z.x;z.dir=Math.sign(d)||z.dir;
          if(Math.abs(d)>32){z.state='walk';z.x+=Math.sign(d)*72*dt;}
          else {if(z.state!=='eat')z.timer=0;z.state='eat';if(z.timer>5){b.life=0;z.state='idle';z.timer=0;}}
        }else {z.state='idle';if(z.timer>7){z.state='run';z.dir=Math.sign(z.x-p.x)||z.dir;z.timer=0;}}
      }else if(z.state==='startle'&&z.timer>(z.species==='hopper'?.22:.5)){z.state='run';z.timer=0;}
      else if(z.state==='run'){
        // Recompute the escape shore after a hunter interception changes direction.
        const exitX=z.dir>0?Math.min(WORLD.width-70,habitat.end-38):Math.max(70,habitat.x+38);
        const distance=(exitX-z.x)*z.dir,atExit=distance<=0;
        if(distance<=TAUNT_APPROACH){
          z.state='taunt';z.timer=0;z.tauntExit=exitX;z.tauntSpeed=speciesFor(z).speed*.85;z.tauntDuration=Math.max(.12,Math.max(0,distance)/z.tauntSpeed);
          z.escapeFloor=habitat.y;this.emit('taunt',{x:z.x,y:z.y,duration:Math.min(TAUNT_DURATION,z.tauntDuration)});
          // Keep momentum on the transition frame. No stationary shoreline wait.
          z.x+=z.dir*z.tauntSpeed*dt;
        }
        if(z.species!=='bird'&&z.grounded&&(PLATFORMS.some(s=>z.y>s.y&&z.x+z.dir*55>s.x&&z.x+z.dir*55<s.x+s.w))){z.vy=-580;z.grounded=false;}
        if(z.species==='hopper'&&z.state==='run'&&z.grounded&&!atExit){z.vy=-320;z.grounded=false;}
        if(z.species==='bird'){
          if(!z.flying){z.flying=true;z.flightTime=0;this.emit('birdTakeoff',{x:z.x});}
          z.flightTime+=dt;z.flightLanding=atExit;
        }
        const hitSpeed=1-HIT_SLOW.reduction*z.hitSlow/HIT_SLOW.duration;
        if(z.state==='run')z.x=clamp(z.x+z.dir*(atExit?0:escapeSpeed(z))*hitSpeed*dt,70,WORLD.width-70);
        if(Math.abs(z.x-p.x)<50&&Math.abs(z.y-p.y)<95&&p.invulnerable<=0){p.stun=.65;p.invulnerable=1.4;this.emit('hurt');z.x=clamp(z.x+z.dir*65,habitat.x+60,habitat.end-60);}
        z.escapeTime=Math.abs(z.x-p.x)>1100?z.escapeTime+dt:0;
        if(z.escapeTime>3)this.escape(z,'out-of-reach');
      }else if(z.state==='taunt'){
        const slow=1-HIT_SLOW.reduction*z.hitSlow/HIT_SLOW.duration;
        z.x+=z.dir*(z.tauntSpeed||70)*slow*dt;
        if(z.grounded&&PLATFORMS.some(s=>z.y>s.y&&z.x+z.dir*55>s.x&&z.x+z.dir*55<s.x+s.w)){z.vy=-580;z.grounded=false;}
        if(z.timer>=(z.tauntDuration??TAUNT_DURATION)||(z.tauntExit!==undefined&&(z.tauntExit-z.x)*z.dir<=0)){z.state='escaping';z.timer=0;z.escapeStartY=z.y;z.flying=false;this.emit('escapeDive',{x:z.x,y:z.y});}
      }else if(z.state==='escaping'){
        const jumpSpeed=180;z.x+=z.dir*jumpSpeed*dt;z.stride+=jumpSpeed*dt;
        z.y=(z.escapeStartY??z.escapeFloor)+escapeJumpOffset(z.timer);
        if(z.timer>=ESCAPE_JUMP_DURATION)this.escape(z);
      }else if(z.state==='hooked'){
        if(z.timer>=.42){z.state='caught';z.timer=0;this.emit('balloon',{x:z.x});}
      }else if(z.state==='caught'){z.y=Math.max(250,z.y-88*dt);}
      if(['notice','idle','walk','run','eat','startle','taunt'].includes(z.state)){
        const dx=z.x-oldX;z.x=oldX;
        if(z.species==='bird'&&['run','taunt'].includes(z.state)){
          // Flight moves the actual collider, not just the drawn sprite. Clear approaching rock tops.
          const ahead=z.x+z.dir*150;
          const rock=PLATFORMS.find(s=>Math.max(z.x,ahead)+35>s.x&&Math.min(z.x,ahead)-35<s.x+s.w);
          const base=rock?Math.min(habitat.y,rock.y):habitat.y;
          const target=z.state==='taunt'?base:base-birdFlightHeight(z.flightTime);
          z.vy=clamp((target-z.y)*7,-235,165);if(z.state==='taunt'&&target-z.y<1)z.vy=35;
        }else z.vy+=WORLD.gravity*dt;
        moveSolid(z,dx,z.vy*dt,speciesFor(z).halfWidth,speciesFor(z).bodyHeight);z.stride+=Math.abs(z.x-oldX);z.motionSpeed=Math.abs(z.x-oldX)/dt;
        if(z.y>670)this.escape(z,'fell');
      }
    }
    this.updateDogs(dt);this.updateHarpoon(dt);this.updateShip(dt);
    if(this.delivered+this.escaped===this.prey.length&&this.ship.phase==='standby'){
      this.completeTimer+=dt;if(this.completeTimer>.5){this.finished=true;this.emit('complete',{caught:this.caught,delivered:this.delivered,escaped:this.escaped,total:this.prey.length});}
    }
    if(!this.finished&&this.remaining>0&&this.baitCount===0){
      this.baitSupplyRemaining=Math.max(0,(this.baitSupplyRemaining??BAIT_SUPPLY_SECONDS)-dt);
      if(this.baitSupplyRemaining<1e-6){this.baitCount=2;this.baitSupplyRemaining=null;this.emit('resupply');}
    }else this.baitSupplyRemaining=null;
  }
}
