(function(){
  if(window.__MSK_LICENSE_GATE__) return;
  window.__MSK_LICENSE_GATE__=true;

  function lock(){
    try{ document.documentElement.classList.add('msk-license-locked'); }catch(_){ }
    window.__MSK_LICENSE_UNLOCKED__=false;
  }
  function unlock(){
    try{ document.documentElement.classList.remove('msk-license-locked'); }catch(_){ }
    window.__MSK_LICENSE_UNLOCKED__=true;
  }

  lock();

  chrome.runtime.onMessage.addListener(function(msg){
    if(!msg) return;
    if(msg.type==='MSK_LICENSE_UNLOCK') unlock();
    if(msg.type==='MSK_LICENSE_LOCK') lock();
  });

  try{
    chrome.storage.onChanged.addListener(function(changes,area){
      if(area!=='local') return;
      if(changes.msk_license_active){
        if(changes.msk_license_active.newValue===true) unlock();
        else lock();
      }
    });
  }catch(_){ }

  try{
    chrome.runtime.sendMessage({action:'licenseStatus'},function(r){
      if(r && r.success) unlock(); else lock();
    });
  }catch(_){ }
})();
