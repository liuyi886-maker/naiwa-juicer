export const RUN_CYCLE=140;
export function approach(value,target,amount){return value+Math.sign(target-value)*Math.min(Math.abs(target-value),amount);}
export class SimulationClock{
 constructor(){this.remainder=0;this.step=1/120;}
 advance(delta,update){this.remainder+=Math.max(0,Math.min(.12,delta));let n=0;while(this.remainder>=this.step-1e-9){update(this.step);this.remainder-=this.step;n++;}return n;}
 reset(){this.remainder=0;}
}
export function updatePose(p,dt,landed=false){
 const blend=(key,target,speed)=>p[key]=(p[key]??0)+(target-(p[key]??0))*(1-Math.exp(-speed*dt));
 blend('runBlend',Math.min(1,Math.abs(p.vx)/295),18);
 blend('airBlend',p.grounded?0:1,20);
 blend('lean',p.vx/295*.055,16);
 p.landSquash=landed?1:Math.max(0,(p.landSquash??0)-dt*6);
}
