export const SAVE_KEY='peach-catcher-save';
const OUTBOX='peach-round-outbox';
const GAME_FIELDS=['level','time','caught','escaped','finished','baitCount','player','prey','dogs','delivered','ship','baits','shots','baitCooldown','completeTimer'];
export function snapshotGame(game){return JSON.parse(JSON.stringify(Object.fromEntries(GAME_FIELDS.map(k=>[k,game[k]]))));}
export function restoreGame(game,value){
 if(!value||value.finished||!Array.isArray(value.prey)||value.prey.length!==8||!value.player||!Array.isArray(value.shots)||!Array.isArray(value.baits)||!Array.isArray(value.dogs)||!value.ship)return false;
 if(!Number.isFinite(value.player.x)||!Number.isFinite(value.player.y)||!Number.isFinite(value.time)||value.player.x<0||value.player.x>9200)return false;
 if(value.prey.some((z,i)=>z.id!==i||!['basic','hopper','bird','shell','longbody'].includes(z.species)||!Number.isFinite(z.x)||!Number.isFinite(z.y)))return false;
 for(const k of GAME_FIELDS)if(!(k in value))return false;
 for(const k of GAME_FIELDS)game[k]=structuredClone(value[k]);game.events=[];game.cancelCharge();return true;
}
export class PlayerStore{
 constructor(){this.local=null;this.revision=0;this.ready=false;this.conflict=false;this.pending=false;this.flushing=false;this.player='本地玩家';this.onStatus=()=>{};this.outbox={};try{this.local=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');this.outbox=JSON.parse(localStorage.getItem(OUTBOX)||'{}');}catch{}this.session=crypto.randomUUID();this.entered=Date.now();this.closed=false;}
 async request(path,body){const response=await fetch('/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,keepalive:!!body,signal:AbortSignal.timeout(5000)});if(response.status===409){this.conflict=true;localStorage.setItem('peach-conflict-backup',JSON.stringify(this.local));const latest=await fetch('/api/bootstrap').then(r=>r.json());if(latest.save)localStorage.setItem(SAVE_KEY,JSON.stringify(latest.save));throw new Error('另一页已更新存档，请刷新后继续');}if(!response.ok)throw new Error('服务器暂不可用，进度保存在本机');return response.json();}
 async init(){
  try{const remote=await this.request('bootstrap');this.player=remote.player;this.revision=remote.revision;this.ready=true;
   if(remote.save&&(!this.local||(remote.save.updatedAt||0)>=(this.local.updatedAt||0))){this.local=remote.save;localStorage.setItem(SAVE_KEY,JSON.stringify(this.local));}
   else if(this.local)this.pending=true;
   this.onStatus('已连接 · 自动存档');await this.flush();
  }catch(e){this.onStatus('离线存档 · 联网后同步');}
  this.visit();this.interval=setInterval(()=>{this.visit();this.flush();},15000);
  addEventListener('pagehide',()=>this.leave());
  addEventListener('pageshow',e=>{if(e.persisted){this.session=crypto.randomUUID();this.entered=Date.now();this.closed=false;this.visit();}});
  document.addEventListener('visibilitychange',()=>this.visit());return this.local;
 }
 save(value){if(this.conflict)return false;this.local={...value,version:3,updatedAt:Date.now()};try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.local));this.pending=true;this.onStatus(this.ready?'已保存 · 正在同步':'已保存在本机');}catch{this.onStatus('本机存储空间不足');}this.flush();return true;}
 recordRound(record){if(!record?.id)return;this.outbox[record.id]=record;try{localStorage.setItem(OUTBOX,JSON.stringify(this.outbox));}catch{}this.flush();}
 async flush(){
  if(this.flushing||this.conflict)return;this.flushing=true;
  try{
   if(!this.ready){const remote=await this.request('bootstrap');if(remote.save&&(remote.save.updatedAt||0)>(this.local?.updatedAt||0)){this.conflict=true;throw new Error('服务器有更新存档，请刷新后继续');}this.revision=remote.revision;this.player=remote.player;this.ready=true;}
   if(this.pending&&this.local){const sending=this.local;const result=await this.request('save',{revision:this.revision,save:sending});this.revision=result.revision;this.pending=this.local!==sending;this.onStatus('已保存到服务器');}
   for(const [id,record] of Object.entries(this.outbox)){await this.request('round',record);if(this.outbox[id]===record)delete this.outbox[id];localStorage.setItem(OUTBOX,JSON.stringify(this.outbox));}
  }catch(e){this.onStatus(this.conflict?e.message:'已保存在本机 · 等待同步');}finally{this.flushing=false;}
 }
 visit(){if(!this.ready||this.closed)return;const body={id:this.session,elapsed:Math.max(0,(Date.now()-this.entered)/1000)};this.request('visit',body).catch(()=>{});}
 leave(){if(this.closed)return;this.beforeLeave?.();this.closed=true;if(!this.ready)return;const send=(path,body)=>navigator.sendBeacon('/api/'+path,new Blob([JSON.stringify(body)],{type:'application/json'}));send('visit',{id:this.session,elapsed:Math.max(0,(Date.now()-this.entered)/1000),ended:true});if(this.pending&&this.local&&!this.flushing&&!this.conflict)send('save',{revision:this.revision,save:this.local});for(const r of Object.values(this.outbox))send('round',r);}
}
