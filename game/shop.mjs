import {RECIPES,productFor,drawProduct} from './products.mjs?v=mobile-load-13';
// Shop presentation follows completed sales; it never creates currency or stock.
export class ShopPresentation {
 constructor(){this.lastSales=null;this.soldAt=-Infinity;this.customer=0;}
 sync(sales,t){if(this.lastSales===null){this.lastSales=sales;return false;}if(sales>this.lastSales){this.customer+=sales-this.lastSales;this.soldAt=t;this.lastSales=sales;return true;}this.lastSales=sales;return false;}
 phase(t){return Math.max(0,Math.min(1,(t-this.soldAt)/1.85));}
}
export function shopSupply(lab,now){
 if(lab.cups>0){const available=RECIPES.filter(r=>lab.products[r.id]>0),r=available[lab.sales%available.length];return {title:'正在营业',detail:`${r.name} · 每份 ${r.price} 金币 · 共 ${lab.cups} 份现货`,busy:true};}
 const jobs=lab.machines.filter(m=>m.ends>now);
 if(jobs.length){const seconds=Math.ceil((Math.min(...jobs.map(m=>m.ends))-now)/1000);return {title:'下一批正在送来',detail:`地下加工还需 ${seconds} 秒 · 顾客正在等候`,busy:false};}
 return {title:'饮料售罄',detail:RECIPES.some(r=>lab.stocks[r.species]>=r.cost)?'仓库有原料，前往地下加工室开始生产':'先去捕猎补充原料，再回来制作产品',busy:false};
}
const ink='#293d39';
function panel(c,x,y,w,h,color,stroke=ink,r=10){c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();if(stroke){c.lineWidth=3;c.strokeStyle=stroke;c.stroke();}}
function oval(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function words(c,s,x,y,size,color='#fff0bc'){c.font=`900 ${size}px "PingFang SC",sans-serif`;c.textAlign='center';c.fillStyle=color;c.fillText(s,x,y);}
const shopMotion=new ShopPresentation();
function shopper(c,atlas,id,x,y,t,walking=false,drink=false,alpha=1,product=RECIPES[0]){
 c.save();c.globalAlpha=alpha;oval(c,x,y+1,35,7,'#233d3a44');
 if(drink){c.translate(x*2,0);c.scale(-1,1);}
 const bounce=walking?Math.abs(Math.sin(t*10))*3:Math.sin(t*2+id)*1;
 if(atlas?.complete&&atlas.naturalWidth){const sw=atlas.width/3,sh=atlas.height-40,w=172*sw/sh;c.drawImage(atlas,(id%3)*sw,20,sw,sh,x-w/2,y-172-bounce,w,172);}
 if(drink)drawProduct(c,product,x-29,y-81-bounce,.7);
 c.restore();
}
export function renderShop(c,lab,t,assets){
 const motion=shopMotion;motion.sync(lab.sales,t);const p=motion.phase(t),now=Date.now();
 if(assets.shopBg?.complete)c.drawImage(assets.shopBg,0,0,1280,720);
 else{c.fillStyle='#34534e';c.fillRect(0,0,1280,720);}
 // The foreground remains live: counter drinks, supply lamp, pickup, queue and sales.
 const types=RECIPES.filter(r=>lab.products[r.id]>0),shelf=types.length===1?Array(Math.min(5,lab.products[types[0].id])).fill(types[0]):types;shelf.forEach((r,i)=>drawProduct(c,r,588+i*30,442,.74));
 const supply=shopSupply(lab,now);
 oval(c,105,459,7,7,lab.machines.some(m=>m.ends>now)?'#a5e375':'#cfad61');
 if(lab.machines.some(m=>m.ends>now)){c.save();c.globalAlpha=.15+.08*Math.sin(t*4);oval(c,105,459,18,18,'#b8ef83');c.restore();}
 // On a real sale the served customer leaves right; the next customers advance once.
 const move=p<1?1-Math.pow(1-p,3):1;
 for(let i=2;i>=0;i--){const x=887+i*133+(p<1?133*(1-move):0);shopper(c,assets.shopCustomers,(motion.customer+i)%3,x,594,t,p<.9);}
 if(p<1){shopper(c,assets.shopCustomers,(motion.customer+2)%3,887+430*move,617,t,true,true,1-Math.max(0,(p-.8)*5),productFor(lab.lastSale?.id));
  c.save();c.globalAlpha=1-p;words(c,`+${lab.lastSale?.price||5}`,812,415-p*65,30,'#ffe56c');c.restore();}
 // Order bubble above the first customer is quiet while waiting for stock.
 panel(c,853,347,68,51,'#fff0ce','#537067',12);c.fillStyle='#fff0ce';c.beginPath();c.moveTo(874,395);c.lineTo(879,408);c.lineTo(890,395);c.fill();
 if(lab.cups){const available=RECIPES.filter(r=>lab.products[r.id]);drawProduct(c,available[lab.sales%available.length],887,386,.65);}else words(c,'···',887,378,29,'#657a67');
 // Dedicated footer: status, lifetime counter and actual collectable cash are distinct.
 const shade=c.createLinearGradient(0,615,0,720);shade.addColorStop(0,'#173b31e8');shade.addColorStop(1,'#102b28');c.fillStyle=shade;c.fillRect(0,623,1280,97);c.fillStyle='#759773';c.fillRect(0,623,1280,3);
 c.textAlign='left';c.font='900 23px "PingFang SC",sans-serif';c.fillStyle=supply.busy?'#e3ec9b':'#ffdd85';c.fillText(supply.title,35,657);c.font='600 16px "PingFang SC",sans-serif';c.fillStyle='#c3d8c7';c.fillText(supply.detail,35,686);
 c.textAlign='right';c.fillStyle='#f2e2ad';c.font='800 20px "PingFang SC",sans-serif';c.fillText(`累计售出 ${lab.sales} 份`,1238,655);
}
