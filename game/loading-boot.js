// Runs before the game bundle: slow/failed script downloads still have visible feedback.
(()=>{
 const panel=document.querySelector('#loadingPanel'),bar=document.querySelector('#loadingProgress'),title=document.querySelector('#loadingTitle'),detail=document.querySelector('#loadingDetail'),retry=document.querySelector('#loadingRetry');
 let ready=false,moduleLoaded=false,failed=false,slowTimer;
 const slow=()=>{clearTimeout(slowTimer);slowTimer=setTimeout(()=>{if(!ready&&!failed){detail.textContent='当前网络较慢，仍在下载。可以继续等待，或重试加载。';retry.hidden=false;}},12000);};
 slow();
 const bootTimer=setTimeout(()=>{if(!moduleLoaded){title.textContent='连接游戏资源较慢';detail.textContent='请检查网络后重试，已保存的进度不会被清除。';retry.hidden=false;}},20000);
 window.naiwaLoader={
  moduleReady(){moduleLoaded=true;clearTimeout(bootTimer);},
  progress(done,total){if(ready||failed)return;retry.hidden=true;const percent=window.naiwaStartupProgress?90+Math.round(done/total*10):Math.round(done/total*100);bar.max=100;bar.value=percent;title.textContent=`游戏加载中 · ${Math.min(100,percent)}%`;detail.textContent=`正在准备角色与场景 ${done} / ${total}`;slow();},
  ready(){ready=true;clearTimeout(bootTimer);clearTimeout(slowTimer);clearInterval(byteTimer);panel.hidden=true;document.querySelector('#intro').setAttribute('aria-busy','false');if('serviceWorker' in navigator&&!new URLSearchParams(location.search).has('nosw'))setTimeout(()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}),1500);},
  error(){failed=true;clearTimeout(slowTimer);title.textContent='部分素材未能加载';detail.textContent='检查网络后点击重试，已下载的素材会保留。';retry.hidden=false;},
  retry(){failed=false;retry.hidden=true;title.textContent='正在重新连接…';detail.textContent='正在继续准备游戏';slow();}
 };
 retry.onclick=()=>{if(!failed){location.reload();return;}window.naiwaLoader.retry();if(moduleLoaded)document.querySelector('#retryAssets').click();else if(window.naiwaStartProgram)window.naiwaStartProgram();else location.reload();};
 const poster=document.querySelector('.home-art');
 function reveal(){if(poster.naturalWidth>0)document.querySelector('.home-poster').classList.add('poster-ready');}
 poster.addEventListener('load',reveal);if(poster.complete)reveal();
 if(window.naiwaPrepareCover){
  let coverGeneration=0;
  const showCover=promise=>{const generation=++coverGeneration;promise.then(src=>{if(generation!==coverGeneration)return;poster.src=src;}).catch(()=>{poster.src=matchMedia('(orientation: portrait)').matches?'assets/instant-v1/title-mobile.webp':'assets/instant-v1/title-screen.webp';});};
  showCover(window.naiwaCoverDownload);matchMedia('(orientation: portrait)').addEventListener('change',()=>showCover(window.naiwaPrepareCover()));
 }
 document.querySelector('#intro').setAttribute('aria-busy','true');
 let shownBytes=-1;
 const byteTimer=setInterval(()=>{const p=window.naiwaStartupProgress;if(ready||failed||moduleLoaded||!p||p.loaded===shownBytes)return;shownBytes=p.loaded;bar.max=100;bar.value=p.loaded/p.total*90;title.textContent=`游戏加载中 · ${Math.round(bar.value)}%`;detail.textContent=`正在下载捕猎素材 ${(p.loaded/1048576).toFixed(1)} / ${(p.total/1048576).toFixed(1)} MB`;},150);
})();
