// Runs before the game bundle: slow/failed script downloads still have visible feedback.
(()=>{
 const panel=document.querySelector('#loadingPanel'),bar=document.querySelector('#loadingProgress'),title=document.querySelector('#loadingTitle'),detail=document.querySelector('#loadingDetail'),retry=document.querySelector('#loadingRetry');
 let ready=false,moduleLoaded=false,failed=false,slowTimer;
 const slow=()=>{clearTimeout(slowTimer);slowTimer=setTimeout(()=>{if(!ready&&!failed){detail.textContent='当前网络较慢，仍在下载。可以继续等待，或重试加载。';retry.hidden=false;}},12000);};
 slow();
 const bootTimer=setTimeout(()=>{if(!moduleLoaded){title.textContent='连接游戏资源较慢';detail.textContent='请检查网络后重试，已保存的进度不会被清除。';retry.hidden=false;}},20000);
 window.naiwaLoader={
  moduleReady(){moduleLoaded=true;clearTimeout(bootTimer);},
  progress(done,total){if(ready||failed)return;retry.hidden=true;bar.max=total;bar.value=done;title.textContent=`游戏加载中 · ${Math.min(100,Math.round(done/total*100))}%`;detail.textContent=`正在准备角色与场景 ${done} / ${total}`;slow();},
  ready(){const art=document.querySelector('.home-art');const source=art?.parentElement?.querySelector('source[data-srcset]');if(source)source.srcset=source.dataset.srcset;if(art?.dataset?.src)art.src=art.dataset.src;ready=true;clearTimeout(bootTimer);clearTimeout(slowTimer);panel.hidden=true;document.querySelector('#intro').setAttribute('aria-busy','false');},
  error(){failed=true;clearTimeout(slowTimer);title.textContent='部分素材未能加载';detail.textContent='检查网络后点击重试，已下载的素材会保留。';retry.hidden=false;},
  retry(){failed=false;retry.hidden=true;title.textContent='正在重新连接…';detail.textContent='正在继续准备游戏';slow();}
 };
 retry.onclick=()=>{if(!failed){location.reload();return;}window.naiwaLoader.retry();if(moduleLoaded)document.querySelector('#retryAssets').click();else location.reload();};
 const poster=document.querySelector('.home-art');
 function reveal(){if(poster.naturalWidth>0)document.querySelector('.home-poster').classList.add('poster-ready');}
 poster.addEventListener('load',reveal);if(poster.complete)reveal();
 document.querySelector('#intro').setAttribute('aria-busy','true');
 if('serviceWorker' in navigator&&!new URLSearchParams(location.search).has('nosw'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
})();
