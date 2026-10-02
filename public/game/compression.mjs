const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
export function compressionPose(machine,now){
 if(!machine.ends||now>=machine.ends)return {active:false,progress:0,press:0,juice:0,alpha:0,stage:'等待装料',cycle:0};
 const progress=clamp(1-(machine.ends-now)/machine.duration);
 if(progress<.05)return {active:true,progress,press:0,juice:0,alpha:smooth(progress/.05),stage:'装料就位',cycle:0};
 if(progress>=.93){const drain=(progress-.93)/.07;return {active:true,progress,press:.96,juice:1-smooth(drain),alpha:1-smooth(drain),stage:'输送饮品',cycle:6};}
 const position=(progress-.05)/.88*6,cycle=Math.floor(position),phase=position-cycle;
 let press,stage;
 if(phase<.45){press=smooth(phase/.45);stage='液压下压';}
 else if(phase<.65){press=1;stage='挤压出汁';}
 else if(phase<.93){press=1-smooth((phase-.65)/.28);stage='压板回升';}
 else {press=0;stage='回弹复位';}
 return {active:true,progress,press,juice:clamp(progress*.75+press*.2),alpha:1,stage,cycle};
}
const box=(c,x,y,w,h,r,fill,stroke='#283d42')=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}};
export function drawCompression(c,m,now,t,drawCreature,recipe={}){
 const pose=compressionPose(m,now),plateBottom=263+145*pose.press,sy=(485-plateBottom)/222;
 c.save();c.beginPath();c.roundRect(-63,231,126,257,30);c.clip();
 if(pose.active){
  // Three characters share the same floor and compress with the available chamber height.
  c.save();c.globalAlpha=pose.alpha;
  c.translate(0,485);c.scale(1+pose.press*.25,sy);
  for(let j=0;j<3;j++)drawCreature(j%2?13:-13,-j*74,72);
  c.restore();
  const liquidY=483-36*pose.juice;
  c.fillStyle=(recipe.color||'#f2bf43')+'77';c.beginPath();c.moveTo(-65,490);c.lineTo(-65,liquidY);
  for(let x=-65;x<=65;x+=5)c.lineTo(x,liquidY+Math.sin(t*8+x*.12)*pose.press*2);c.lineTo(65,490);c.fill();
  if(pose.press>.4)for(let j=0;j<7;j++){const y=479-((t*33+j*19)%42);c.fillStyle='#fff4adbb';c.beginPath();c.ellipse(-46+j*15,y,2,3,0,0,Math.PI*2);c.fill();}
 }
 const rod=c.createLinearGradient(-9,0,9,0);rod.addColorStop(0,'#42545c');rod.addColorStop(.45,'#e8f0d9');rod.addColorStop(1,'#74898b');
 box(c,-9,224,18,plateBottom-234,3,rod);
 const metal=c.createLinearGradient(0,plateBottom-18,0,plateBottom);metal.addColorStop(0,'#dee4c6');metal.addColorStop(.35,'#a9bbb2');metal.addColorStop(1,'#5c787d');
 box(c,-61,plateBottom-18,122,18,4,metal);box(c,-59,plateBottom-3,118,5,1,'#344f53');
 for(const x of [-46,46]){c.fillStyle='#304a50';c.beginPath();c.arc(x,plateBottom-10,3,0,Math.PI*2);c.fill();}
 c.restore();
 // Exterior juice outlet is connected to the bottom of the cylinder and the rear pipe.
 c.lineJoin='round';c.lineCap='round';c.beginPath();c.moveTo(70,476);c.lineTo(116,476);c.lineTo(116,554);c.lineTo(154,554);c.strokeStyle='#263c40';c.lineWidth=16;c.stroke();c.strokeStyle='#6e8d87';c.lineWidth=10;c.stroke();
 if(pose.active&&pose.progress>.08){c.save();c.strokeStyle=recipe.color||'#e6b94c';c.lineWidth=5;c.setLineDash([11,9]);c.lineDashOffset=-t*(pose.press>.4?55:18);c.stroke();c.restore();}
 box(c,105,490,22,13,3,'#abb7a0');
 // Compression pressure dial.
 c.fillStyle='#213b3f';c.beginPath();c.arc(114,315,22,0,Math.PI*2);c.fill();c.strokeStyle='#a8b8a3';c.lineWidth=4;c.stroke();
 c.save();c.translate(114,315);c.rotate(-2.35+pose.press*3.9);c.strokeStyle=pose.press>.8?'#edb854':'#b9d474';c.lineWidth=3;c.beginPath();c.moveTo(0,0);c.lineTo(16,0);c.stroke();c.restore();
 return pose;
}
