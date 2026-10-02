import {BackgroundMusic} from './background-music.mjs';
import {embeddedAudio,audioMirrors} from './audio-files.mjs';
import {downloadAudio} from './audio-download.mjs';
import {TAUNT_DURATION,TAUNT_AUDIO_OFFSET} from './taunt.mjs?v=hunt-fixes-7';
// User-approved original clips; numbers refer to the audition order.
export const HIT_VOICE_FILES=Object.freeze({basic:'05-andi.wav',bird:'04-oula.wav',hopper:'02-gajiaosai.wav',shell:'03-gangbadi.wav',longbody:'01-gagadilaxi.wav'});
export class AudioEngine {
 constructor(){this.enabled=true;this.ctx=null;this.last={};this.laugh=null;this.music=null;this.hitBuffers={};this.pending=new Map();this.noiseBuffers=new Map();}
 loadBuffer(url){
  if(this.pending.has(url))return this.pending.get(url);
  const task=(async()=>{
   const data=embeddedAudio[url];
   const bytes=data?Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer:await downloadAudio(url,{mirrors:audioMirrors});
   return this.ctx.decodeAudioData(bytes);
  })();
  this.pending.set(url,task);task.finally(()=>this.pending.delete(url)).catch(()=>{});return task;
 }
 loadHitVoices(){
  if(!this.ctx)return Promise.resolve();
  return Promise.all(Object.entries(HIT_VOICE_FILES).map(async([species,file])=>{
   if(this.hitBuffers[species])return;
   try{this.hitBuffers[species]=await this.loadBuffer(`assets/audio/hit-voices-v3/${file}`);}catch{}
  }));
 }
 playHitVoice(species){
  if(!this.enabled||!this.ctx)return;
  const buffer=this.hitBuffers[species];if(!buffer){this.loadHitVoices();return;}
  const c=this.ctx,t=c.currentTime,source=c.createBufferSource(),gain=c.createGain();
  source.buffer=buffer;gain.gain.value=.65;source.connect(gain);gain.connect(this.effects);
  source.onended=()=>{source.disconnect();gain.disconnect();};
  this.duckUntil=Math.max(this.duckUntil||0,t+buffer.duration+.12);source.start();
 }
 resume(){
  if(!this.enabled||!this.ctx)return;
  // Safari can enter interrupted after a call, screen lock, or switching applications.
  if(this.ctx.state==='suspended'||this.ctx.state==='interrupted')this.ctx.resume().catch(()=>{});
 }
 unlock(){
  if(!this.enabled)return Promise.resolve();
  try{if(navigator.audioSession)navigator.audioSession.type='playback';}catch{}
  if(!this.ctx){
   const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return Promise.resolve();
   this.ctx=new Context();this.effects=this.ctx.createGain();this.effects.connect(this.ctx.destination);
   this.musicGain=this.ctx.createGain();this.musicGain.gain.value=0;this.musicGain.connect(this.ctx.destination);this.duckUntil=0;
   this.music=new BackgroundMusic(this.ctx,this.musicGain,{url:'assets/audio/naiwaxxl-bgm-original.mp3',mirrors:audioMirrors,onStatus:status=>this.onMusicStatus?.(status)});
   this.ctx.onstatechange=()=>{if(this.ctx.state==='running'){this.effectsTarget=undefined;this.musicTarget=undefined;}};
  }
  this.resume();if(typeof document==='undefined'||!document.hidden)this.music?.play({retry:true});
  if(!this.laughReady&&!this.laugh)this.laughReady=this.loadBuffer('assets/characters/basic/taunt/reference/laugh-original.wav').then(b=>{this.laugh=b;}).catch(()=>{}).finally(()=>{this.laughReady=null;});
  return Promise.all([this.laughReady,this.loadHitVoices()]);
 }
 musicTick(active){
  if(!this.ctx)return;const c=this.ctx,t=c.currentTime,shouldPlay=this.enabled&&active,on=shouldPlay&&c.state==='running';
  const effectsTarget=this.enabled?1:0,musicTarget=on?(t<this.duckUntil?.07:.18):0;
  if(this.effectsTarget!==effectsTarget){this.effects.gain.setTargetAtTime(effectsTarget,t,.03);this.effectsTarget=effectsTarget;}
  this.music?.setActive(shouldPlay);
  // Change gains only when state changes, rather than enqueueing automation every frame.
  if(this.musicTarget!==musicTarget){this.musicGain.gain.setTargetAtTime(musicTarget,t,.09);this.musicTarget=musicTarget;}
 }

 voice(kind='curious',volume=1){
  if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime,key=kind==='ouch'?'hitVoice':'voice';if(t-(this.last[key]??-10)<(kind==='ouch'?.07:.65))return;this.last[key]=t;this.duckUntil=Math.max(this.duckUntil||0,t+.8);
  const pattern={alert:[[330,650,.18],[520,390,.16]],ouch:[[280,135,.25]],caught:[[510,240,.34]],eat:[[175,220,.12],[180,160,.16]],curious:[[215,330,.18],[310,220,.17]],laugh:[[250,410,.1],[260,430,.12],[250,320,.18]]}[kind]||[[250,180,.2]];
  let delay=0;for(const [from,to,duration] of pattern){const start=t+delay,o=c.createOscillator(),gain=c.createGain();o.type='sawtooth';o.frequency.setValueAtTime(from,start);o.frequency.exponentialRampToValueAtTime(to,start+duration);gain.gain.setValueAtTime(.001,start);gain.gain.exponentialRampToValueAtTime(.035*volume,start+.025);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
   const nodes=[];for(const [frequency,q,weight] of [[650,4,1],[1250,5,.55],[2500,8,.2]]){const f=c.createBiquadFilter(),g=c.createGain();f.type='bandpass';f.frequency.value=frequency;f.Q.value=q;g.gain.value=weight;o.connect(f);f.connect(g);g.connect(gain);nodes.push(f,g);}o.onended=()=>{o.disconnect();gain.disconnect();nodes.forEach(n=>n.disconnect());};gain.connect(this.effects);o.start(start);o.stop(start+duration+.01);delay+=duration+.055;
  }
 }
 tone(freq,end,duration,vol=.12,type='sine',delay=0){
  if(!this.enabled||!this.ctx)return;const c=this.ctx,t=c.currentTime+delay,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(vol,t+.009);g.gain.exponentialRampToValueAtTime(.001,t+duration);o.connect(g);g.connect(this.effects);o.onended=()=>{o.disconnect();g.disconnect();};o.start(t);o.stop(t+duration+.02);
 }
 noise(duration,vol,frequency){
  if(!this.enabled||!this.ctx)return;const c=this.ctx,n=Math.ceil(c.sampleRate*duration);let b=this.noiseBuffers.get(n);if(!b){b=c.createBuffer(1,n,c.sampleRate);const d=b.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*(1-i/n);this.noiseBuffers.set(n,b);}const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=b;f.type='lowpass';f.frequency.value=frequency;g.gain.value=vol;s.connect(f);f.connect(g);g.connect(this.effects);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();};s.start();
 }
 play(type,options={}){
  if(!this.enabled||!this.ctx)return;const t=this.ctx.currentTime;
  // Each accepted hit already has a species. Do not globally throttle different targets.
  if(type==='preyHit'){this.playHitVoice(options.species);return;}
  if(t-(this.last[type]??-10)<(type==='step'?.24:type==='jet'?.13:type==='shipEngine'?.5:.07))return;this.last[type]=t;if(['shoot','reel','pickup','taunt'].includes(type))this.duckUntil=Math.max(this.duckUntil||0,t+(type==='taunt'?(options.duration??TAUNT_DURATION):.65));
  switch(type){
   case 'shipEngine':this.noise(.55,.055,620);this.tone(65,85,.5,.028,'triangle');break;
   case 'taunt':if(this.laugh){const s=this.ctx.createBufferSource(),g=this.ctx.createGain();s.buffer=this.laugh;g.gain.value=.36;s.connect(g);g.connect(this.effects);s.onended=()=>{s.disconnect();g.disconnect();};s.start(0,Math.min(TAUNT_AUDIO_OFFSET,Math.max(0,this.laugh.duration-TAUNT_DURATION)),Math.min(options.duration??TAUNT_DURATION,this.laugh.duration*.8));}break;
   case 'loadMachine':this.noise(.16,.06,650);this.tone(160,75,.18,.04,'triangle');break;
   case 'pressDown':this.tone(105,65,.7,.025,'sawtooth');this.noise(.32,.035,550);break;
   case 'squeeze':this.tone(190,75,.3,.035,'triangle');this.tone(350,190,.18,.025,'sine',.12);this.noise(.18,.035,900);break;
   case 'pressUp':this.noise(.26,.035,1600);this.tone(75,130,.35,.018,'sawtooth');break;
   case 'juiceFlow':this.noise(.5,.045,800);this.tone(360,160,.16,.025);this.tone(290,120,.16,.025,'sine',.2);break;
   case 'batchReady':this.tone(660,660,.16,.04);this.tone(880,880,.25,.04,'sine',.13);break;
   case 'birdTakeoff':this.noise(.22,.045,1800);this.tone(900,1450,.18,.022,'sine');break;
   case 'bark':this.tone(190,270,.07,.055,'triangle');this.tone(250,140,.1,.055,'triangle',.1);break;
   case 'dogRepelled':this.tone(430,650,.15,.05);break;
   case 'baitWall':this.noise(.07,.09,950);this.tone(250,140,.1,.04,'triangle');break;
   case 'resistHit':this.noise(.065,.15,3600);this.tone(1450,810,.11,.07,'triangle');break;
   case 'reel':this.noise(.24,.045,2700);this.tone(390,180,.23,.035,'sawtooth');break;
   case 'reload':this.noise(.11,.07,1300);this.tone(170,85,.16,.025,'triangle');break;
   case 'ready':this.noise(.045,.055,3200);this.tone(780,510,.045,.025,'triangle');break;
   case 'balloon':this.tone(180,430,.26,.045);break;
   case 'pickup':this.tone(350,700,.3,.035,'triangle');this.noise(.2,.035,600);break;
   case 'shoot':this.noise(.1,.2,2300);this.tone(350,95,.19,.14,'triangle');this.tone(980,430,.07,.035);break;
   case 'capture':this.tone(420,1100,.15,.12);this.tone(660,1320,.2,.08,'sine',.09);this.noise(.1,.06,1600);break;
   case 'bait':this.noise(.13,.06,1500);break;
   case 'baitLand':this.tone(530,280,.09,.09,'triangle');this.noise(.07,.11,600);break;
   case 'emerge':this.tone(85,55,.35,.045,'triangle');this.noise(.28,.05,380);break;
   case 'emergePop':this.tone(160,430,.19,.06);this.noise(.12,.07,1100);break;
   case 'startle':this.tone(650,960,.12,.06,'triangle');break;
   case 'hurt':this.tone(240,90,.25,.12,'triangle');this.noise(.09,.12,800);break;
   case 'land':this.noise(.09,.085,500);this.tone(100,55,.1,.025);break;
   case 'step':this.noise(.065,.1,420);this.tone(120,70,.07,.035);break;
   case 'jet':this.noise(.17,.065,1200);break;
   case 'delivered':this.tone(740,990,.12,.045);break;
   case 'complete':case 'sale':for(let i=0;i<4;i++)this.tone([523,659,784,1047][i],[523,659,784,1047][i],.28,.08,'sine',i*.12);break;
   case 'click':this.tone(540,720,.06,.04);break;
  }
 }
}
