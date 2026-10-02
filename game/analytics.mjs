// Public site code only. Never put an account password or API key here.
import { analyticsSite } from './analytics-config.mjs';
let started=false;
const queue=[];
const disabled=!analyticsSite||!location.hostname.endsWith('.github.io')||new URLSearchParams(location.search).has('preview')||new URLSearchParams(location.search).has('noanalytics')||navigator.webdriver;
function send(event){
 if(disabled)return;
 if(window.goatcounter?.count){try{window.goatcounter.count(event);}catch{/* Stats must never interrupt play. */}}
 else if(queue.length<3)queue.push(event);
}
if(!disabled){
 window.goatcounter={no_onload:true};
 const script=document.createElement('script');script.async=true;script.src='https://gc.zgo.at/count.js';
 script.dataset.goatcounter=`https://${analyticsSite}.goatcounter.com/count`;
 script.onload=()=>{send({path:'game-home',title:'访问奶娃榨汁机'});for(const event of queue.splice(0))send(event);};
 script.onerror=()=>{queue.length=0;};
 document.head.append(script);
}
export function trackGameStart({demo=false}={}){
 if(disabled||demo||started)return;
 started=true;send({path:'game-start',title:'开始捕猎',event:true});
}
