export const EMERGE_SECONDS=1.25;
const ease=t=>1-Math.pow(1-Math.max(0,Math.min(1,t)),3);
// Rumble beneath the soil, peek, spring upward, then settle into a standing pose.
export function emergencePose(t){
 if(t<.22)return {offset:126-Math.sin(Math.max(0,t)/.22*Math.PI)*4,sx:1,sy:1,tilt:Math.sin(t*48)*.025};
 if(t<.53)return {offset:126-51*ease((t-.22)/.31),sx:1,sy:1,tilt:Math.sin((t-.22)*15)*.05};
 if(t<.98){const q=(t-.53)/.45;return {offset:75-85*ease(q),sx:1-.07*Math.sin(q*Math.PI),sy:1+.08*Math.sin(q*Math.PI),tilt:Math.sin(q*Math.PI)*-.06};}
 const q=Math.min(1,(t-.98)/.27);return {offset:-10*(1-ease(q)),sx:1+.08*Math.sin(q*Math.PI),sy:1-.07*Math.sin(q*Math.PI),tilt:0};
}
export function drawBurrow(c,z,floor,time){
 const active=z.state==='emerging',r=active?Math.sin(z.timer*39)*2:0;
 const oval=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
 oval(z.home,floor-3,48,9,'#172e2b');oval(z.home,floor-1,39,5,'#0e2223');
 for(let k=0;k<7;k++)oval(z.home-43+k*14,floor-6+Math.sin(k*2)*3+(active?r:0),9,5,['#637363','#425c4c','#72806a'][k%3]);
 if(active){
  for(let k=0;k<12;k++){
   const a=z.timer-.05-k*.035;if(a<0||a>.72)continue;
   const dir=k%2?1:-1,dx=dir*(22+(k%5)*9+a*(30+k*6)),dy=-a*(135+(k%4)*18)+235*a*a;
   c.globalAlpha=Math.max(0,1-a/.72);oval(z.home+dx,floor+dy,3+k%3,2+k%2,'#9c9b72');
  }c.globalAlpha=1;
  for(let k=0;k<3;k++){const q=(z.timer*1.8+k*.23)%1;c.globalAlpha=(1-q)*.17;oval(z.home+(k-1)*21,floor-8-q*22,14+q*24,8+q*9,'#a8b294');}c.globalAlpha=1;
 }else if(z.state==='hidden'){const pulse=Math.sin(time*3)*1.5;oval(z.home-6,floor-11+pulse,3,4,'#b5c650');oval(z.home+5,floor-11+pulse,3,4,'#b5c650');}
}
