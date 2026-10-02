export const SAVE_KEY='peach-catcher-save';
const GAME_FIELDS=['level','time','caught','escaped','finished','baitCount','player','prey','dogs','delivered','ship','baits','shots','baitCooldown','completeTimer'];
export function snapshotGame(game){return JSON.parse(JSON.stringify(Object.fromEntries(GAME_FIELDS.map(k=>[k,game[k]]))));}
export function restoreGame(game,value){
 if(!value||value.finished||!Array.isArray(value.prey)||value.prey.length!==8||!value.player||!Array.isArray(value.shots)||!Array.isArray(value.baits)||!Array.isArray(value.dogs)||!value.ship)return false;
 if(!Number.isFinite(value.player.x)||!Number.isFinite(value.player.y)||!Number.isFinite(value.time)||value.player.x<0||value.player.x>9200)return false;
 if(value.prey.some((z,i)=>z.id!==i||!['basic','hopper','bird','shell','longbody'].includes(z.species)||!Number.isFinite(z.x)||!Number.isFinite(z.y)))return false;
 for(const k of GAME_FIELDS)if(!(k in value))return false;
 for(const k of GAME_FIELDS)game[k]=structuredClone(value[k]);game.events=[];game.cancelCharge();return true;
}
// Local-only adapter. Shared snapshot/restore helpers are prepended by build-static.mjs.
export class PlayerStore {
 constructor(){
  this.local=null;this.ready=false;this.conflict=false;this.pending=false;this.onStatus=()=>{};
  try{const value=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');if(value&&typeof value==='object'&&!Array.isArray(value))this.local=value;}catch{}
 }
 async init(){
  try{localStorage.setItem('naiwa-storage-check','1');localStorage.removeItem('naiwa-storage-check');this.ready=true;}catch{}
  addEventListener('pagehide',()=>this.beforeLeave?.());
  return this.local;
 }
 save(value){
  if(this.conflict)return false;
  this.local={...value,version:3,updatedAt:Date.now()};
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(this.local));this.ready=true;this.onStatus('进度已保存在此浏览器');return true;}
  catch{this.ready=false;this.onStatus('浏览器无法保存进度，请勿关闭页面');return false;}
 }
 // The game's save.history retains the latest 100 completed/abandoned rounds.
 recordRound(){}
}
