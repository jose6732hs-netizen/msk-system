'use strict';
/* Wrapper do service worker: carrega o motor original e adiciona a camada de licença. */
try { importScripts('license-core.js', 'background.js'); }
catch (e) { console.error('[MSK Live] falha ao carregar núcleo', e); }

var MSKLIVE_ACCESS_KEY = 'msklive_last_access';
var MSKLIVE_HEARTBEAT_ALARM = 'msklive-license-heartbeat';

function mskliveFriendly(code) {
  try { return self.MSKLiveLicense.friendly(code); } catch (e) { return 'Licença MSK LIVE não liberada.'; }
}
function mskliveStoreGet(keys) {
  return new Promise(function(resolve){ try{ chrome.storage.local.get(keys,function(v){resolve(v||{});}); }catch(e){resolve({});} });
}
function mskliveStoreSet(obj) {
  return new Promise(function(resolve){ try{ chrome.storage.local.set(obj,function(){resolve();}); }catch(e){resolve();} });
}
function mskliveNotify(tabId, msg) {
  try { var p = chrome.tabs.sendMessage(tabId, msg); if (p && p.catch) p.catch(function(){}); } catch (e) {}
}
async function mskliveInjectTools(tabId) {
  if (!Number.isFinite(Number(tabId))) return false;
  tabId = Number(tabId);
  try {
    var marker = await chrome.scripting.executeScript({
      target:{tabId:tabId},
      func:function(){ if(window.__MSKLIVE_TOOLS_INJECTED__) return false; window.__MSKLIVE_TOOLS_INJECTED__=true; return true; }
    });
    if (!marker || !marker[0] || marker[0].result !== true) return true;
    await chrome.scripting.executeScript({target:{tabId:tabId},files:['injector.js'],world:'MAIN'});
    await chrome.scripting.executeScript({target:{tabId:tabId},files:['content.js']});
    return true;
  } catch (e) {
    try { console.warn('[MSK Live] falha ao injetar ferramenta', e); } catch (_) {}
    return false;
  }
}
async function mskliveTikTokTabs() {
  try { return await chrome.tabs.query({url:['https://shop.tiktok.com/*','https://*.tiktok.com/*']}); } catch(e) { return []; }
}
async function mskliveEngineTabs() {
  try { return await chrome.tabs.query({url:chrome.runtime.getURL('video-engine.html')+'*'}); } catch(e) { return []; }
}
async function mskliveBroadcastAccess(licensed, code) {
  var msg = {type:'MSKLIVE_LICENSE_CHANGED',licensed:!!licensed,code:code||null,message:licensed?'Licença ativa.':mskliveFriendly(code)};
  var tabs = await mskliveTikTokTabs();
  for (var i=0;i<tabs.length;i++) if(tabs[i].id) mskliveNotify(tabs[i].id,msg);
}
async function mskliveStopToolsOnRevocation(code) {
  var engines = await mskliveEngineTabs();
  for (var i=0;i<engines.length;i++) {
    try { await chrome.tabs.update(engines[i].id,{url:chrome.runtime.getURL('start.html?reason='+encodeURIComponent(code||'LICENSE_INACTIVE'))}); } catch(e) {}
  }
  var tabs = await mskliveTikTokTabs();
  for (var j=0;j<tabs.length;j++) {
    if (!tabs[j].id) continue;
    try { await chrome.tabs.reload(tabs[j].id); } catch(e) {}
  }
}
async function mskliveRememberAccess(licensed, code) {
  var old = await mskliveStoreGet([MSKLIVE_ACCESS_KEY]);
  var prev = old[MSKLIVE_ACCESS_KEY];
  var now = {licensed:!!licensed,code:code||null,at:Date.now()};
  var o={}; o[MSKLIVE_ACCESS_KEY]=now; await mskliveStoreSet(o);
  await mskliveBroadcastAccess(licensed,code);
  if (prev && prev.licensed === true && !licensed) await mskliveStopToolsOnRevocation(code);
}
async function mskliveLicenseCheck(force) {
  if (!self.MSKLiveLicense) return {licensed:false,code:'LICENSE_SERVICE_UNAVAILABLE',message:'Sistema de licença indisponível.'};
  var result = await self.MSKLiveLicense.refresh(!!force);
  var licensed = !!result.ok;
  var code = result.code || null;
  await mskliveRememberAccess(licensed,code);
  return {licensed:licensed,code:code,state:result.state||null,message:licensed?'Licença ativa.':mskliveFriendly(code)};
}
async function mskliveUnlockOpenTabs() {
  var check = await mskliveLicenseCheck(true);
  if (!check.licensed) return check;
  var tabs = await mskliveTikTokTabs();
  for (var i=0;i<tabs.length;i++) if(tabs[i].id) { await mskliveInjectTools(tabs[i].id); mskliveNotify(tabs[i].id,{type:'MSKLIVE_LICENSE_CHANGED',licensed:true}); }
  return check;
}
function mskliveEnsureAlarm() {
  try { chrome.alarms.create(MSKLIVE_HEARTBEAT_ALARM,{periodInMinutes:1}); } catch(e) {}
}
mskliveEnsureAlarm();
try { chrome.runtime.onInstalled.addListener(mskliveEnsureAlarm); } catch(e) {}
try { chrome.alarms.onAlarm.addListener(function(alarm){ if(alarm&&alarm.name===MSKLIVE_HEARTBEAT_ALARM) mskliveLicenseCheck(true).catch(function(){}); }); } catch(e) {}

chrome.runtime.onMessage.addListener(function(msg,sender,sendResponse){
  if (!msg) return;
  if (msg.type==='MSKLIVE_LICENSE_BOOTSTRAP') {
    (async function(){ var r=await mskliveLicenseCheck(false); if(r.licensed&&sender&&sender.tab&&sender.tab.id) await mskliveInjectTools(sender.tab.id); sendResponse(r); })();
    return true;
  }
  if (msg.type==='MSKLIVE_LICENSE_STATUS' || msg.type==='MSKLIVE_LICENSE_FORCE_REFRESH') {
    (async function(){ sendResponse(await mskliveLicenseCheck(msg.type==='MSKLIVE_LICENSE_FORCE_REFRESH')); })();
    return true;
  }
  if (msg.type==='MSKLIVE_LICENSE_FORM_STATE') {
    (async function(){
      try {
        var saved = await self.MSKLiveLicense.getState();
        sendResponse({email:saved.email||'',token:saved.token||''});
      } catch(e) { sendResponse({email:'',token:''}); }
    })();
    return true;
  }
  if (msg.type==='MSKLIVE_LICENSE_ACTIVATE') {
    (async function(){
      if (!self.MSKLiveLicense) { sendResponse({licensed:false,code:'LICENSE_SERVICE_UNAVAILABLE',message:mskliveFriendly('LICENSE_SERVICE_UNAVAILABLE')}); return; }
      var result = await self.MSKLiveLicense.activate(msg.token, msg.email);
      if (!result.ok) {
        await mskliveRememberAccess(false,result.code||'LICENSE_INVALID');
        sendResponse({licensed:false,code:result.code||'LICENSE_INVALID',message:result.message||mskliveFriendly(result.code)});
        return;
      }
      await mskliveRememberAccess(true,null);
      if (sender&&sender.tab&&sender.tab.id) await mskliveInjectTools(sender.tab.id);
      sendResponse({licensed:true,state:result.state||null,message:'Licença MSK LIVE validada.'});
    })();
    return true;
  }
  if (msg.type==='MSKLIVE_LICENSE_UNLOCK_TIKTOK') {
    (async function(){ sendResponse(await mskliveUnlockOpenTabs()); })();
    return true;
  }
  if (msg.type==='MSKLIVE_ENSURE_TOOLS') {
    (async function(){ var r=await mskliveLicenseCheck(true); if(r.licensed) await mskliveInjectTools(Number(msg.tabId)); sendResponse(r); })();
    return true;
  }
  if (msg.type==='MSKLIVE_LICENSE_FORGOTTEN') {
    mskliveRememberAccess(false,'NO_TOKEN').then(function(){sendResponse({ok:true});});
    return true;
  }
  if (msg.type==='MSKLIVE_OPEN_DASHBOARD') { chrome.tabs.create({url:chrome.runtime.getURL('start.html')}); sendResponse({ok:true}); return; }
  if (msg.type==='MSKLIVE_OPEN_PLANS') { chrome.tabs.create({url:'https://msksystem.online/planos?produto=msk-live'}); sendResponse({ok:true}); return; }
  if (msg.type==='MSKLIVE_OPEN_ACCOUNT') { chrome.tabs.create({url:'https://msksystem.online/painel'}); sendResponse({ok:true}); return; }
});
