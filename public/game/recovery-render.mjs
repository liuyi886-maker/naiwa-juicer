import {capturePoint,speciesFor} from './species.mjs?v=hunt-fixes-7';
import {drawPeachHead} from './brand.mjs?v=hunt-fixes-7';
import {MUZZLE} from './engine.mjs?v=hunt-fixes-7';
const path=(c,points,fill,stroke,width=2)=>{c.beginPath();points(c);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}};
const box=(c,x,y,w,h,r,fill,stroke,width=2)=>path(c,c=>c.roundRect(x,y,w,h,r),fill,stroke,width);
const oval=(c,x,y,rx,ry,fill,stroke,width=2)=>path(c,c=>c.ellipse(x,y,rx,ry,0,0,Math.PI*2),fill,stroke,width);
const line=(c,x,y,x2,y2,color,width=2)=>path(c,c=>{c.moveTo(x,y);c.lineTo(x2,y2);},null,color,width);

export function drawRecoveryCraft(c,ship,time,drawCargo){
 if(ship.y<-170)return;
 const bob=ship.phase==='depart'?0:Math.sin(time*2.5)*2;
 c.save();c.translate(ship.x,ship.y+bob);
 // Open-bottom transport cage. Boarding sprites remain visible behind the bars.
 box(c,-69,-61,145,151,15,'#536266','#192f34',4);
 box(c,-56,-43,117,117,6,'#233637','#17292d',3);
 for(let i=0;i<3;i++)line(c,-49,-15+i*30,55,-15+i*30,'#405052',2);
 drawCargo(0,78);
 if(ship.phase==='loading'){
  const beam=c.createLinearGradient(0,80,0,220);beam.addColorStop(0,'#d4d4a625');beam.addColorStop(1,'#bac39200');c.fillStyle=beam;
  c.beginPath();c.moveTo(-47,76);c.lineTo(47,76);c.lineTo(72,211);c.lineTo(-72,211);c.closePath();c.fill();
 }
 // Riveted olive hull, cockpit and side-mounted jet engine.
 path(c,c=>{c.moveTo(55,-78);c.lineTo(156,-78);c.quadraticCurveTo(180,-73,182,-47);c.lineTo(185,50);c.quadraticCurveTo(181,76,161,79);c.lineTo(75,79);c.quadraticCurveTo(64,68,64,44);c.closePath();},'#8b9160','#35453c',4);
 path(c,c=>{c.moveTo(76,-74);c.lineTo(145,-74);c.quadraticCurveTo(158,-71,163,-58);c.lineTo(163,-38);c.lineTo(76,-38);c.closePath();},'#c0bf84');
 box(c,100,-61,66,57,12,'#344b4b','#515e48',4);
 path(c,c=>{c.moveTo(108,-53);c.lineTo(153,-53);c.lineTo(139,-9);c.lineTo(108,-9);c.closePath();},'#587371');
 line(c,114,-47,143,-47,'#99aaa0',3);line(c,116,-41,136,-41,'#80978b',2);
 box(c,133,-32,23,21,7,'#283e3c');oval(c,140,-23,3,4,'#e6df62');oval(c,151,-23,3,4,'#e6df62');
 box(c,164,1,29,54,9,'#6b7956','#35473d',3);
 box(c,143,9,18,42,4,'#a5aa73');line(c,149,16,155,16,'#67754c',2);
 // Our creature emblem keeps the replacement IP on the rescue vehicle too.
 drawPeachHead(c,95,30,48);
 for(const [x,y] of [[76,-65],[77,67],[174,53],[173,-57],[-59,-49],[-59,75],[64,-50]]){oval(c,x,y,3,3,'#c1c8aa');line(c,x-1,y,x+1,y,'#66746a');}
 box(c,60,74,32,22,7,'#738177','#293e3e',3);box(c,62,94,29,13,4,'#465a58');
 for(let i=0;i<3;i++)oval(c,69+i*8,82,2,3,'#344b46');
 const flame=24+Math.sin(time*32)*7+(ship.phase==='depart'?15:0);
 path(c,c=>{c.moveTo(64,108);c.quadraticCurveTo(64,122,77,108+flame);c.quadraticCurveTo(88,120,88,108);c.closePath();},'#488de7');
 path(c,c=>{c.moveTo(70,108);c.quadraticCurveTo(70,119,77,122);c.quadraticCurveTo(83,116,83,108);c.closePath();},'#bbebf8');
 box(c,-76,-69,154,19,7,'#919e87','#314845',3);line(c,-64,-62,64,-62,'#b9c2a5',3);
 // Sliding door withdraws upward; the cage never vanishes to fake the pickup.
 const doorH=114*(1-ship.gate);
 c.save();c.beginPath();c.rect(-58,-42,118,118);c.clip();
 for(let x=-47;x<=55;x+=23){line(c,x,-45,x,-45+doorH,'#101f25',8);line(c,x-2,-45,x-2,-45+doorH,'#a0aaa0',2);}
 box(c,-58,-45+doorH,118,10,2,'#9ca396','#253b3e',3);c.restore();
 box(c,-70,82,148,11,4,'#8a9585','#304645',3);
 c.restore();
}
export function drawCaptureBalloon(c,z,time){
 let scale=z.state==='hooked'?Math.max(0,(z.timer-.19)/.23):1;
 if(z.state==='boarding')scale=Math.max(0,1-z.timer/.65);
 if(scale<=0)return;
 const sway=Math.sin(time*3+z.id)*5,by=z.y-Math.max(170,speciesFor(z).height+55),anchor=capturePoint(z);
 line(c,anchor.x,anchor.y,z.x+sway,by+27*scale,'#c5c3ab',2);
 c.save();c.translate(z.x+sway,by);c.scale(scale,scale);
 oval(c,0,0,23,29,'#b022c9','#74208b',2);oval(c,-7,-10,7,9,'#d951df');
 path(c,c=>{c.moveTo(0,26);c.lineTo(-5,34);c.lineTo(5,34);c.closePath();},'#9322a8');c.restore();
 // Small attachment loop remains on the carried character after the gun cable returns.
 oval(c,anchor.x,anchor.y,6,4,null,'#d9dcca',2);
}
export const harpoonAngle=s=>s.dir===1?0:Math.PI;
export function drawHarpoon(c,s,p,time){
 const mx=p.x+MUZZLE.x*p.dir,my=p.y+MUZZLE.y,angle=harpoonAngle(s);
 // The winch pulls the shaft tail first; translating home must never reverse the arrowhead.
 const tx=s.x-22*Math.cos(angle),ty=s.y-22*Math.sin(angle),d=Math.hypot(mx-tx,my-ty);
 c.strokeStyle='#b7b5a1';c.lineWidth=2.2;c.beginPath();c.moveTo(mx,my);
 c.quadraticCurveTo((mx+tx)/2,(my+ty)/2+(s.phase==='retract'?Math.min(3,d*.01):Math.min(18,d*.06)),tx,ty);c.stroke();
 if(s.phase==='retract'){
  c.save();c.translate(mx-15*p.dir,my+7);oval(c,0,0,5,5,'#344343','#d6bd61',1.5);c.rotate(time*23*p.dir);
  line(c,-4,0,4,0,'#e1d293',1.5);line(c,0,-4,0,4,'#e1d293',1.5);c.restore();
 }
 c.save();c.translate(s.x,s.y);c.rotate(angle);
 line(c,-22,0,5,0,'#dee3d5',3);path(c,c=>{c.moveTo(-3,-6);c.lineTo(8,0);c.lineTo(-3,6);},null,'#e7e8dc',3);c.restore();
}
