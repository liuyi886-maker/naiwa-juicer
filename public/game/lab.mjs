import {compressionPose,drawCompression} from './compression.mjs?v=hunt-fixes-7';
import {renderShop} from './shop.mjs?v=hunt-fixes-7';
import {RECIPES,productFor,drawProduct} from './products.mjs?v=hunt-fixes-7';
export {RECIPES};
export function recipeFor(i){return RECIPES[i%RECIPES.length];}
const amount=n=>Math.max(0,Math.floor(Number(n)||0));
export class Laboratory{
 constructor(data={}){
  this.stocks=Object.fromEntries(RECIPES.map(r=>[r.species,amount(data.stocks?.[r.species])]));
  this.products=Object.fromEntries(RECIPES.map(r=>[r.id,amount(data.products?.[r.id])]));
  if(!data.stocks)this.stocks.basic=amount(data.stock);
  if(!data.products)this.products.peach=amount(data.cups);
  this.sales=amount(data.sales);this.cash=amount(data.cash);this.nextSale=Math.max(0,Number(data.nextSale)||0);this.lastSale=data.lastSale||null;
  this.machines=Array.from({length:Math.max(2,Math.ceil((data.machines?.length||2)/2)*2)},(_,i)=>{
   const old=data.machines?.[i],ends=Math.max(0,Number(old?.ends)||0);
   return {unlocked:i===0||!!old?.unlocked,level:Math.max(0,Math.min(3,amount(old?.level))),duration:Math.max(1,Number(old?.duration)||recipeFor(i).seconds*1000),ends,
    recipeId:productFor(old?.recipeId||(old?'peach':recipeFor(i).id)).id,
    job:ends?(old?.job||{recipeId:'peach',cups:i%2?12:10}):null};
  });
 }
 get stock(){return Object.values(this.stocks).reduce((a,b)=>a+b,0);}
 get cups(){return Object.values(this.products).reduce((a,b)=>a+b,0);}
 set cups(n){this.products=Object.fromEntries(RECIPES.map(r=>[r.id,r.id==='peach'?amount(n):0]));}
 serialize(){return {version:2,stocks:{...this.stocks},products:{...this.products},stock:this.stock,cups:this.cups,sales:this.sales,cash:this.cash,nextSale:this.nextSale,lastSale:this.lastSale,machines:this.machines.map(m=>({...m,job:m.job?{...m.job}:null}))};}
 addStock(n,species='basic'){if(species in this.stocks)this.stocks[species]+=amount(n);}
 addCaptured(prey){for(const z of prey)if(z.state==='delivered')this.addStock(1,z.species);}
 recipe(i){return productFor(this.machines[i]?.job?.recipeId||this.machines[i]?.recipeId);}
 selectRecipe(i,id){const m=this.machines[i];if(!m?.unlocked||m.ends||!RECIPES.some(r=>r.id===id))return false;m.recipeId=id;return true;}
 start(i,now){const m=this.machines[i],r=this.recipe(i);if(!m?.unlocked||m.ends||this.stocks[r.species]<r.cost)return false;this.stocks[r.species]-=r.cost;m.duration=r.seconds*1000/(1+m.level*.3);m.job={recipeId:r.id,cups:r.cups};m.ends=now+m.duration;return true;}
 advance(now){
  let changed=false;
  this.machines.forEach(m=>{if(m.ends&&now>=m.ends){const job=m.job;this.products[productFor(job?.recipeId).id]+=job?.cups||10;m.ends=0;m.job=null;changed=true;}});
  if(this.cups&&now>=this.nextSale){const available=RECIPES.filter(r=>this.products[r.id]>0),r=available[this.sales%available.length];this.products[r.id]--;this.sales++;this.cash+=r.price;this.lastSale={id:r.id,price:r.price};this.nextSale=now+2200;changed=true;}
  return changed;
 }
 collect(){const n=this.cash;this.cash=0;return n;}
 upgradeCost(i){return 80+this.machines[i].level*60;}
 upgrade(i,coins){const m=this.machines[i];if(!m?.unlocked||m.level>=3||coins<this.upgradeCost(i))return 0;const cost=this.upgradeCost(i);m.level++;return cost;}
 get floorCount(){return this.machines.length/2;}
 expansionCost(){return 300+(this.floorCount-1)*200;}
 expand(coins){const cost=this.expansionCost();if(coins<cost)return 0;for(let j=0;j<2;j++){const r=recipeFor(this.machines.length);this.machines.push({unlocked:j===0,level:0,duration:r.seconds*1000,ends:0,recipeId:r.id,job:null});}return cost;}
 unlockCost(i){return 200+Math.floor(i/2)*50;}
 unlock(i,coins){const m=this.machines[i];if(!m||m.unlocked||coins<this.unlockCost(i))return 0;m.unlocked=true;return this.unlockCost(i);}
}
const box=(c,x,y,w,h,r,fill,stroke='#253b36',lw=3)=>{c.beginPath();c.roundRect(x,y,w,h,r);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}};
const ellipse=(c,x,y,rx,ry,fill,stroke)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=3;c.stroke();}};
const text=(c,s,x,y,size=22,col='#ece8c5')=>{c.fillStyle=col;c.font=`900 ${size}px "PingFang SC",sans-serif`;c.textAlign='center';c.fillText(s,x,y);};
function pipe(c,pts){for(const [color,width]of[['#253c35',18],['#74866b',11],['#a0ad8b',3]]){c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.stroke();}}
export function renderLab(c,lab,t,drawCreature,shop,assets={},floor=0){
 const g=c.createLinearGradient(0,0,0,720);g.addColorStop(0,shop?'#394951':'#344740');g.addColorStop(1,shop?'#526444':'#263a32');c.fillStyle=g;c.fillRect(0,0,1280,720);
 if(shop){renderShop(c,lab,t,assets);return;}
 if(assets.labBg?.complete)c.drawImage(assets.labBg,0,0,1280,720);else{c.fillStyle='#304653';c.fillRect(0,0,1280,720);}
 const now=Date.now();
 for(let i=0;i<2;i++){
  const idx=floor*2+i,x=340+i*565,m=lab.machines[idx],r=lab.recipe(idx),busy=m.ends>now,remaining=Math.max(0,Math.ceil((m.ends-now)/1000)),pose=compressionPose(m,now);
  c.save();c.translate(x+(busy?Math.sin(t*27)*pose.press*.65:0),72);c.scale(.76,.76);
  if(!m.unlocked){
   ellipse(c,0,560,140,19,'#243443');box(c,-125,499,250,60,12,'#687c86','#253c47',5);
   box(c,-104,510,208,25,5,'#36495b');for(let j=0;j<7;j++)box(c,-96+j*29,514,18,17,2,'#788b92',null);
   box(c,-19,482,38,46,6,'#d3b253','#3b463f',4);box(c,-12,471,24,19,8,'#9ca39a','#3b463f',4);ellipse(c,0,501,4,5,'#384840');
   text(c,'购置压榨机',0,456,26,'#b8c6c2');text(c,'可切换五种产品配方',0,603,20,'#bcc7ba');c.restore();continue;
  }
  const steel=c.createLinearGradient(-110,0,110,0);steel.addColorStop(0,'#4c6871');steel.addColorStop(.35,'#acc2ba');steel.addColorStop(.7,'#7b9694');steel.addColorStop(1,'#3c5964');ellipse(c,0,560,129,20,'#132a30aa');box(c,-115,494,230,65,15,steel);
  box(c,-82,216,164,292,46,m.unlocked?'#728b9b':'#43554c','#233e38',6);
  box(c,-65,229,130,262,36,m.unlocked?'#bad2ce88':'#62726633',null);
  drawCompression(c,m,now,t,(x,y,h)=>drawCreature(x,y,h,r.species),r);
  box(c,-50,267,7,166,4,'#e6f8ed33',null);
  box(c,-96,197,192,36,12,steel);box(c,-81,158,162,46,10,'#73828e');
  box(c,-32,136,64,23,7,'#849b7c');ellipse(c,0,173,10,10,busy?'#eec45a':'#aed48b','#2e4c42');
  box(c,-103,497,206,14,4,'#a8b293');
  box(c,-92,518,184,23,6,'#283e3b');if(busy){const progress=Math.max(0,Math.min(1,1-(m.ends-now)/m.duration));box(c,-89,521,178*progress,17,4,'#a8d442',null);text(c,`${Math.floor(progress*100)}%`,0,536,17,'#f6f5d1');}else text(c,'等待装料',0,536,16,'#b5c7bc');
  text(c,`设备 ${idx+1}`,0,143,20,'#f0d66c');

  c.restore();
 }
}
