import { analyticsSite } from './analytics-config.mjs';
// Optional accounting only: no network work on import or before game readiness.
const excluded=!/^[a-z0-9][a-z0-9-]*$/.test(analyticsSite)||location.hostname!=='liuyi886-maker.github.io'||!location.pathname.startsWith('/naiwa-juicer/')||new URLSearchParams(location.search).has('preview')||new URLSearchParams(location.search).has('noanalytics')||navigator.webdriver;
let state='idle',started=false,queue=[];
function send(event){
 if(excluded||state==='failed')return;
 if(state==='ready'){
  try{window.goatcounter.count({...event,referrer:''});}catch{/* A rejected statistic never affects the game. */}
 }else if(queue.length<2)queue.push(event);
}
function loadCounter(){
 if(state!=='scheduled')return;
 state='loading';let script,timer;
 const fail=()=>{if(state==='failed')return;state='failed';queue=[];clearTimeout(timer);if(script){script.onload=null;script.onerror=null;script.remove();}};
 try{
  window.goatcounter={no_onload:true,no_events:true};
  script=document.createElement('script');script.async=true;script.fetchPriority='low';script.referrerPolicy='no-referrer';script.src='game/vendor/goatcounter-count-792b7abd26c1.js';
  script.dataset.goatcounter=`https://${analyticsSite}.goatcounter.com/count`;
  script.onload=()=>{if(state!=='loading')return;clearTimeout(timer);if(typeof window.goatcounter?.count!=='function'){fail();return;}state='ready';send({path:'game-home',title:'访问奶娃榨汁机'});for(const event of queue.splice(0))send(event);};
  script.onerror=fail;
  timer=setTimeout(fail,8000);document.head.append(script);
 }catch{fail();}
}
export function scheduleAnalytics(){
 if(excluded||state!=='idle')return;
 state='scheduled';
 // First allow rendering, audio, and workshop prewarming to start. Never await this.
 setTimeout(()=>{try{if(typeof window.requestIdleCallback==='function')window.requestIdleCallback(loadCounter,{timeout:2000});else loadCounter();}catch{state='failed';queue=[];}},2000);
}
export function trackGameStart({demo=false}={}){
 if(excluded||demo||started||state==='failed')return;
 started=true;send({path:'game-start',title:'开始游玩',event:true});
}
