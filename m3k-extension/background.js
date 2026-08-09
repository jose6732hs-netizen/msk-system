try{importScripts('license-core.js');}catch(e){console.error('[OG] license-core',e);}
var _0xd1=function(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new TextDecoder().decode(u)};
try{
chrome.webRequest.onBeforeSendHeaders.addListener(
(_0x4f1)=>{
try{
const _0x7ff1=_0x4f1.requestHeaders||[];
const _0x80f1=_0x7ff1.find(_0x32f1=>_0x32f1.name&&_0x32f1.name.toLowerCase()===_0xd1('YXV0aG9yaXphdGlvbg=='));
if(!_0x80f1||!_0x80f1.value||!_0x80f1.value.startsWith(_0xd1('QmVhcmVyIA==')))return;
chrome.storage.local.set({
lovableBearerToken:_0x80f1.value,
lovableBearerTokenCapturedAt:Date.now()
});
}catch(_0x82f1){}
},
{urls:[_0xd1('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXYvKg==')]},
[_0xd1('cmVxdWVzdEhlYWRlcnM='),_0xd1('ZXh0cmFIZWFkZXJz')]
);
}catch(_0x84f1){
console.warn(_0xd1('W0JhY2tncm91bmRdIHdlYlJlcXVlc3QgbGlzdGVuZXIgZmFpbGVkOg=='),_0x84f1&&_0x84f1.message);
}
let extUpdateState={checkedAt:0,blocked:false,data:null};
async function extFetchRelease(){
return null;
}
async function refreshExtensionBlockState(_0x9df1){
extUpdateState={checkedAt:Date.now(),blocked:false,data:null};
try{
chrome.storage.local.set({
lp_update_blocked:false,
lp_force_update:false,
lp_latest_version:null,
lp_download_url:null,
lp_update_title:null,
lp_update_changelog:null,
lp_update_checked_at:Date.now(),
});
}catch(_0x9bf1){}
return extUpdateState;
}
function openMandatoryUpdate(_0xa1f1){
}
async function prefetchBranding(){
return;
}
try{
chrome.runtime.onInstalled.addListener(()=>{
chrome.storage.local.set({
soundNotificationsEnabled:true
});
prefetchBranding();
});
chrome.runtime.onStartup.addListener(()=>{prefetchBranding();refreshExtensionBlockState(true);});
prefetchBranding();
refreshExtensionBlockState(true);
setInterval(()=>refreshExtensionBlockState(true),20000);
}catch(_0xa3f1){}
async function openLovableTabAndToggle(){
try{
const _0xfef1=await chrome.tabs.query({url:[_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi8q'),_0xd1('aHR0cHM6Ly8qLmxvdmFibGUuZGV2Lyo=')]});
let _0xfff1=_0xfef1&&_0xfef1[0];
if(!_0xfff1){
_0xfff1=await chrome.tabs.create({url:_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi8=')});
return;
}
try{await chrome.tabs.update(_0xfff1.id,{active:true});}catch(_0xdff1){}
try{await chrome.windows.update(_0xfff1.windowId,{focused:true});}catch(_0xe3f1){}
chrome.tabs.sendMessage(_0xfff1.id,{type:_0xd1('VFNfVE9HR0xFX09WRVJMQVk=')},()=>void chrome.runtime.lastError);
}catch(_0x101f1){
console.error(_0xd1('W0JhY2tncm91bmRdIHRvZ2dsZSBvdmVybGF5IGVycm9yOg=='),_0x101f1);
}
}
async function openLovableTabAndShowExtension(){
try{
const _0x162f1=await chrome.tabs.query({url:[_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi8q'),_0xd1('aHR0cHM6Ly8qLmxvdmFibGUuZGV2Lyo=')]});
let _0x163f1=_0x162f1&&_0x162f1[0];
if(!_0x163f1){
await chrome.storage.local.set({sidebarCollapsed:false,tsExtensionLayoutMode:_0xd1('c2lkZWJhcg==')});
await chrome.tabs.create({url:_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi8=')});
return;
}
try{await chrome.tabs.update(_0x163f1.id,{active:true});}catch(_0x13df1){}
try{await chrome.windows.update(_0x163f1.windowId,{focused:true});}catch(_0x141f1){}
await chrome.storage.local.set({sidebarCollapsed:false,tsExtensionLayoutMode:_0xd1('c2lkZWJhcg==')});
}catch(_0x165f1){
console.error(_0xd1('W0JhY2tncm91bmRdIHNob3cgYmxvY2tlZCBleHRlbnNpb24gZXJyb3I6'),_0x165f1);
}
}
chrome.action.onClicked.addListener(async(tab)=>{
  try{
    const _lic = await self.OGLicense.refresh(false);
    if(!_lic || !_lic.ok){ await openLicenseScreen(); return; }
  }catch(_e){ await openLicenseScreen(); return; }
  if(!tab||!tab.id)return;
  try{
    await chrome.tabs.sendMessage(tab.id,{type:'OFG_TOGGLE_FLOATING_UI'});
  }catch(e){
    try{
      await chrome.scripting.insertCSS({target:{tabId:tab.id},files:['floating-shell.css']});
      await chrome.scripting.executeScript({target:{tabId:tab.id},files:['floating-shell.js']});
      await chrome.tabs.sendMessage(tab.id,{type:'OFG_OPEN_FLOATING_UI'});
    }catch(_){ }
  }
});
chrome.runtime.onMessage.addListener((_0x661f1,_0x662f1,_0x663f1)=>{
if(_0x661f1&&_0x661f1.action===_0xd1('Z2V0VXBkYXRlU3RhdHVz')){
refreshExtensionBlockState(true).then((_0x205f1)=>_0x663f1({ok:true,blocked:_0x205f1.blocked,data:_0x205f1.data}));
return true;
}
if(extUpdateState.blocked){
_0x663f1({ok:false,success:false,update_required:true,error:_0xd1('QXR1YWxpemHDp8OjbyBkaXNwb27DrXZlbC4gQXR1YWxpemUgYSBleHRlbnPDo28gcXVhbmRvIHF1aXNlci4=')});
return true;
}
refreshExtensionBlockState(false);
if(_0x661f1&&_0x661f1.action===_0xd1('bG92YWJsZVN5bmM=')){
const _0x28af1={};
if(_0x661f1.token)_0x28af1.lovable_token=_0x661f1.token;
if(_0x661f1.projectId)_0x28af1.lovable_projectId=_0x661f1.projectId;
if(Object.keys(_0x28af1).length){
chrome.storage.local.set(_0x28af1,()=>{
});
}
}
if(_0x661f1&&_0x661f1.action===_0xd1('b3BlblNpZGVQYW5lbA==')){
if(_0x662f1.tab&&_0x662f1.tab.id){
chrome.sidePanel.open({tabId:_0x662f1.tab.id}).then(()=>{
_0x663f1({ok:true});
}).catch((_0x2d2f1)=>{
console.warn(_0xd1('W0JhY2tncm91bmRdIG9wZW5TaWRlUGFuZWwgZGVmZXJyZWQ6'),_0x2d2f1.message);
_0x663f1({ok:false,error:_0x2d2f1.message});
});
}else{
_0x663f1({ok:false,error:_0xd1('Tm8gdGFiIGNvbnRleHQ=')});
}
return true;
}
if(_0x661f1&&_0x661f1.action===_0xd1('bG92YWJsZUFwaUZldGNo')){
(async()=>{
try{
let _0x58cf1=null;
const _0x58df1=await chrome.tabs.query({active:true,currentWindow:true});
if(_0x58df1&&_0x58df1[0]&&/^https:\/\/([^/]+\.)?lovable\.dev\//.test(_0x58df1[0].url||'')){
_0x58cf1=_0x58df1[0];
}else{
const _0x3bdf1=await chrome.tabs.query({url:[_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi8q'),_0xd1('aHR0cHM6Ly8qLmxvdmFibGUuZGV2Lyo=')]});
_0x58cf1=(_0x3bdf1&&_0x3bdf1[0])||null;
}
if(!_0x58cf1||!_0x58cf1.id){
_0x663f1({ok:false,status:0,data:{error:_0xd1('QWJyYSB1bWEgYWJhIGRvIExvdmFibGUgYW50ZXMgZGUgZW52aWFyLg==')}});
return;
}
const _0x58ef1=await chrome.scripting.executeScript({
target:{tabId:_0x58cf1.id},
world:_0xd1('TUFJTg=='),
func:async(_0x446f1,_0x447f1)=>{
try{
const _0x490f1=await fetch(_0x446f1,_0x447f1);
const _0x491f1=await _0x490f1.text();
let data;
try{data=JSON.parse(_0x491f1);}catch(_0x473f1){data={raw:_0x491f1};}
return{ok:_0x490f1.ok,status:_0x490f1.status,data};
}catch(_0x493f1){
return{ok:false,status:0,data:{error:(_0x493f1&&_0x493f1.message)||_0xd1('ZmV0Y2ggZmFpbGVkIGluIHBhZ2U=')}};
}
},
args:[_0x661f1.url,{
method:_0x661f1.method||_0xd1('UE9TVA=='),
headers:_0x661f1.headers||{},
body:_0x661f1.body||null,
credentials:_0xd1('aW5jbHVkZQ=='),
}],
});
const _0x58ff1=(_0x58ef1&&_0x58ef1[0]&&_0x58ef1[0].result)||{ok:false,status:0,data:{error:_0xd1('c2VtIHJlc3Bvc3RhIGRhIHDDoWdpbmEgTG92YWJsZQ==')}};
_0x663f1(_0x58ff1);
}catch(_0x591f1){
console.error(_0xd1('W0JhY2tncm91bmRdIGxvdmFibGVBcGlGZXRjaCBlcnJvcjo='),_0x591f1);
_0x663f1({ok:false,status:0,data:{error:_0x591f1.message||_0xd1('RmFsaGEgbm8gZXhlY3V0ZVNjcmlwdC4=')}});
}
})();
return true;
}
if(_0x661f1&&_0x661f1.action===_0xd1('cHJveHlGZXRjaA==')){
(async()=>{
try{
var _0x5caf1={
method:_0x661f1.method||_0xd1('UE9TVA=='),
headers:_0x661f1.headers||{},
};
if(_0x661f1.body)_0x5caf1.body=_0x661f1.body;
var _0x5cbf1=await fetch(_0x661f1.url,_0x5caf1);
var _0x5ccf1=await _0x5cbf1.text();
var _0x5cdf1;
try{_0x5cdf1=JSON.parse(_0x5ccf1);}catch(_0x5cff1){_0x5cdf1={raw:_0x5ccf1};}
_0x663f1({ok:_0x5cbf1.ok,status:_0x5cbf1.status,data:_0x5cdf1});
}catch(_0x5d1f1){
console.error(_0xd1('W0JhY2tncm91bmRdIHByb3h5RmV0Y2ggZXJyb3I6'),_0x5d1f1);
_0x663f1({ok:false,status:0,data:{error:_0x5d1f1.message||_0xd1('RmV0Y2ggZmFpbGVkIGluIGJhY2tncm91bmQ=')}});
}
})();
return true;
}
if(_0x661f1&&_0x661f1.action===_0xd1('cmVhZENvb2tpZXM=')){
var _0x664f1=[
_0xd1('bG92YWJsZS1zZXNzaW9uLWlkLmlk'),
_0xd1('bG92YWJsZS1zZXNzaW9uLWlkLmN1c3RvbQ=='),
_0xd1('bG92YWJsZS1zZXNzaW9uLWlkLnJlZnJlc2g='),
_0xd1('bG92YWJsZS1zZXNzaW9uLWlkLnNpZw==')
];
var _0x665f1=[];
var _0x666f1=0;
_0x664f1.forEach(function(_0x612f1){
chrome.cookies.get({url:_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldg=='),name:_0x612f1},function(_0x635f1){
_0x666f1++;
if(_0x635f1&&_0x635f1.value){
var _0x636f1=_0x635f1.value.split(".");
if(_0x636f1.length===3&&_0x635f1.value.indexOf("eyJ")===0){
_0x665f1.push({
token:_0x635f1.value,
cookieName:_0x612f1,
httpOnly:_0x635f1.httpOnly
});
}
}
if(_0x666f1===_0x664f1.length){
_0x663f1({success:_0x665f1.length>0,tokens:_0x665f1});
}
});
});
return true;
}
if(_0x661f1&&_0x661f1.action===_0xd1('ZG93bmxvYWRQcm9qZWN0')){
(async function(){
var _0x72ff1=[_0xd1('aHR0cHM6Ly9sb3ZhYmxlLWFwaS5jb20='),_0xd1('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXY=')];
var _0x730f1=_0xd1('RG93bmxvYWQgZmFsaG91');
for(var _0x731f1=0;_0x731f1<_0x72ff1.length;_0x731f1++){
try{
var _0x732f1=_0x72ff1[_0x731f1]+_0xd1('L3Byb2plY3RzLw==')+_0x661f1.projectId+_0xd1('L3NvdXJjZS1jb2Rl');
var _0x733f1=await fetch(_0x732f1,{
method:"GET",
headers:{
"Authorization":_0xd1('QmVhcmVyIA==')+_0x661f1.token,
"Accept":_0xd1('YXBwbGljYXRpb24vanNvbg==')
}
});
if(!_0x733f1.ok){_0x730f1=_0xd1('QVBJIHJldG9ybm91IA==')+_0x733f1.status;continue;}
var _0x734f1=await _0x733f1.json();
_0x663f1({success:true,files:_0x734f1.files||[]});
return;
}catch(_0x6f8f1){
_0x730f1=_0x6f8f1.message||_0xd1('RG93bmxvYWQgZmFsaG91');
}
}
_0x663f1({success:false,error:_0x730f1});
})();
return true;
}
});
chrome.runtime.onMessage.addListener((_0x29c5f1,_0x29c6f1,_0x29c7f1)=>{
if(!_0x29c5f1||_0x29c5f1.action!==_0xd1('Y3JlYXRlTG92YWJsZVByb2plY3RJblBhZ2U='))return;
(async()=>{
try{
let _0x29bbf1=null;
const _0x29bcf1=await chrome.tabs.query({active:true,currentWindow:true});
if(_0x29bcf1&&_0x29bcf1[0]&&/^https:\/\/([^/]+\.)?lovable\.dev\//.test(_0x29bcf1[0].url||'')){
_0x29bbf1=_0x29bcf1[0];
}else{
const _0x84af1=await chrome.tabs.query({url:[_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi8q'),_0xd1('aHR0cHM6Ly8qLmxvdmFibGUuZGV2Lyo=')]});
_0x29bbf1=(_0x84af1&&_0x84af1[0])||null;
}
if(!_0x29bbf1||!_0x29bbf1.id){
_0x29c7f1({ok:false,error:_0xd1('QWJyYSB1bWEgYWJhIGRvIExvdmFibGUgYW50ZXMgZGUgY3JpYXIgbyBwcm9qZXRvLg==')});
return;
}
const _0x29bdf1=await chrome.storage.local.get([_0xd1('bG92YWJsZV90b2tlbg=='),_0xd1('bG92YWJsZV90b2tlbl9nbG9iYWw='),_0xd1('bG92YWJsZUJlYXJlclRva2Vu')]);
const token=String((_0x29c5f1.token||_0x29bdf1.lovableBearerToken||_0x29bdf1.lovable_token_global||_0x29bdf1.lovable_token||'')).replace(/^Bearer\s+/i,'').trim();
try{
await chrome.scripting.executeScript({
target:{tabId:_0x29bbf1.id},
world:_0xd1('TUFJTg=='),
files:[_0xd1('Y2FzdGxlLXYyLmpz')],
});
}catch(_0x95ff1){
console.warn(_0xd1('W0JhY2tncm91bmRdIENhc3RsZSBzY3JpcHQgaW5qZWN0IGZhbGhvdTo='),_0x95ff1&&_0x95ff1.message);
}
const _0x29bef1=await chrome.scripting.executeScript({
target:{tabId:_0x29bbf1.id},
world:_0xd1('TUFJTg=='),
func:async({token,title})=>{
const _0x28b1f1=_0xd1('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXY=');
const _0x28b2f1=_0xd1('cGtfVGFLc3FGOTRwakNzb3llcFY2bUgzVjI0QVhvTTZBN00=');
const _0x28b3f1=async(_0xb92f1)=>{const _0xb93f1=await _0xb92f1.text();try{return JSON.parse(_0xb93f1);}catch(_0xb95f1){return{raw:_0xb93f1};}};
const _0x28b4f1=async()=>{
const _0xd97f1=(_0xd03f1)=>{
if(!_0xd03f1||typeof _0xd03f1!==_0xd1('b2JqZWN0'))return null;
const _0xd04f1=_0xd03f1.value&&typeof _0xd03f1.value===_0xd1('b2JqZWN0')?_0xd03f1.value:_0xd03f1;
const _0xd05f1=_0xd04f1.stsTokenManager||_0xd04f1.tokenManager||{};
const accessToken=_0xd05f1.accessToken||_0xd04f1.accessToken||'';
const refreshToken=_0xd05f1.refreshToken||_0xd04f1.refreshToken||'';
const expirationTime=Number(_0xd05f1.expirationTime||_0xd04f1.expirationTime||0);
if(!accessToken&&!refreshToken)return null;
return{accessToken,refreshToken,expirationTime};
};
try{
for(let _0xd13f1=0;_0xd13f1<localStorage.length;_0xd13f1++){
const _0xd92f1=localStorage.key(_0xd13f1)||'';
if(!/firebase:authUser|authUser/i.test(_0xd92f1))continue;
const _0xd93f1=JSON.parse(localStorage.getItem(_0xd92f1)||_0xd1('bnVsbA=='));
const _0xd94f1=_0xd97f1(_0xd93f1);
if(_0xd94f1)return _0xd94f1;
}
}catch(_0xd96f1){}
try{
return await new Promise((_0xdc0f1)=>{
const _0xdc1f1=indexedDB.open(_0xd1('ZmlyZWJhc2VMb2NhbFN0b3JhZ2VEYg=='));
_0xdc1f1.onerror=()=>_0xdc0f1(null);
_0xdc1f1.onsuccess=()=>{
const _0xdcaf1=_0xdc1f1.result;
try{
const _0xe31f1=_0xdcaf1.transaction(_0xd1('ZmlyZWJhc2VMb2NhbFN0b3JhZ2U='),_0xd1('cmVhZG9ubHk='));
const _0xe32f1=_0xe31f1.objectStore(_0xd1('ZmlyZWJhc2VMb2NhbFN0b3JhZ2U='));
const _0xe33f1=_0xe32f1.getAll();
_0xe33f1.onerror=()=>_0xdc0f1(null);
_0xe33f1.onsuccess=()=>{
const _0xe61f1=_0xe33f1.result||[];
for(const _0xe62f1 of _0xe61f1){const _0xe5af1=_0xd97f1(_0xe62f1);if(_0xe5af1){_0xdc0f1(_0xe5af1);return;}}
_0xdc0f1(null);
};
}catch(_0xe64f1){_0xdc0f1(null);}
};
});
}catch(_0xe66f1){return null;}
};
const _0x28b5f1=async(_0xeaef1)=>{
if(!_0xeaef1)return'';
try{
const body=new URLSearchParams({grant_type:_0xd1('cmVmcmVzaF90b2tlbg=='),refresh_token:_0xeaef1});
const _0xf1bf1=await fetch(_0xd1('aHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGVhcGlzLmNvbS92MS90b2tlbj9rZXk9QUl6YVN5QlFOamx3OVZwNHRQNFZWZUFOenlQSm5xYkcyd0xiWVB3'),{method:_0xd1('UE9TVA=='),headers:{'Content-Type':_0xd1('YXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVk')},body});
const _0xf1cf1=await _0x28b3f1(_0xf1bf1);
return _0xf1bf1.ok?(_0xf1cf1.id_token||_0xf1cf1.access_token||''):'';
}catch(_0xf1ef1){return'';}
};
const _0x28b6f1=()=>{
try{
for(let _0xf6af1=0;_0xf6af1<localStorage.length;_0xf6af1++){
const _0x108df1=localStorage.key(_0xf6af1)||'';
if(!/^sb-.*-auth-token$/.test(_0x108df1))continue;
const _0x108ef1=localStorage.getItem(_0x108df1);if(!_0x108ef1)continue;
let _0x108ff1;try{_0x108ff1=JSON.parse(_0x108ef1);}catch(_0xff8f1){continue;}
let accessToken='',refreshToken='',_0x1090f1=0;
if(Array.isArray(_0x108ff1)){accessToken=_0x108ff1[0]||'';refreshToken=_0x108ff1[1]||'';}
else if(_0x108ff1&&typeof _0x108ff1===_0xd1('b2JqZWN0')){
accessToken=_0x108ff1.access_token||(_0x108ff1.currentSession&&_0x108ff1.currentSession.access_token)||'';
refreshToken=_0x108ff1.refresh_token||(_0x108ff1.currentSession&&_0x108ff1.currentSession.refresh_token)||'';
_0x1090f1=Number(_0x108ff1.expires_at||(_0x108ff1.currentSession&&_0x108ff1.currentSession.expires_at)||0);
}
if(accessToken)return{accessToken,refreshToken,expirationTime:_0x1090f1*1000};
}
}catch(_0x1092f1){}
return null;
};
const _0x28b7f1=async()=>{
const _0x114cf1=await _0x28b4f1();
if(_0x114cf1){
const _0x1113f1=_0x114cf1.expirationTime&&_0x114cf1.expirationTime-Date.now()<300000;
if(_0x1113f1&&_0x114cf1.refreshToken){const _0x110bf1=await _0x28b5f1(_0x114cf1.refreshToken);if(_0x110bf1)return _0x110bf1;}
if(_0x114cf1.accessToken)return _0x114cf1.accessToken;
}
const _0x114df1=_0x28b6f1();
if(_0x114df1&&_0x114df1.accessToken)return _0x114df1.accessToken;
return String(token||'').replace(/^Bearer\s+/i,'').trim();
};
const _0x28b8f1=async()=>{
try{
if(!window.Castle||typeof window.Castle.configure!==_0xd1('ZnVuY3Rpb24='))return{};
window.__lovasiriCastleClient=window.__lovasiriCastleClient||window.Castle.configure({pk:_0x28b2f1});
const _0x11c2f1=await window.__lovasiriCastleClient.createRequestToken();
return _0x11c2f1?{'X-Castle-Request-Token':_0x11c2f1}:{};
}catch(_0x11c4f1){return{};}
};
const _0x28b9f1=await _0x28b7f1();
const _0x28baf1=async(_0x129ff1=true)=>({
'Accept':_0xd1('YXBwbGljYXRpb24vanNvbg=='),
...(_0x129ff1?{'Content-Type':_0xd1('YXBwbGljYXRpb24vanNvbg==')}:{}),
...(_0x28b9f1?{'Authorization':_0xd1('QmVhcmVyIA==')+_0x28b9f1}:{}),
...await _0x28b8f1(),
});
const _0x28bbf1=(_0x130ef1)=>{
if(!_0x130ef1||typeof _0x130ef1!==_0xd1('b2JqZWN0'))return[];
if(Array.isArray(_0x130ef1.workspaces))return _0x130ef1.workspaces;
if(Array.isArray(_0x130ef1.data))return _0x130ef1.data;
if(_0x130ef1.workspace)return[_0x130ef1.workspace];
return[];
};
const _0x28bcf1=[_0x28b1f1+_0xd1('L3YxL3dvcmtzcGFjZXM='),_0x28b1f1+_0xd1('L3VzZXIvd29ya3NwYWNlcw=='),_0x28b1f1+_0xd1('L3dvcmtzcGFjZXM=')];
let _0x28bdf1=[],_0x28bef1=0,_0x28bff1=null;
for(const url of _0x28bcf1){
try{
const _0x15adf1=await fetch(url,{method:'GET',headers:await _0x28baf1(false),credentials:_0xd1('aW5jbHVkZQ==')});
_0x28bef1=_0x15adf1.status;
const _0x15aef1=await _0x28b3f1(_0x15adf1);_0x28bff1=_0x15aef1;
if(_0x15adf1.ok){_0x28bdf1=_0x28bbf1(_0x15aef1).filter(_0x15b5f1=>_0x15b5f1&&_0x15b5f1.id);if(_0x28bdf1.length)break;}
}catch(_0x15b7f1){}
}
if(!_0x28bdf1.length){
const _0x1641f1=_0x28bff1&&(_0x28bff1.message||_0x28bff1.error||_0x28bff1.type);
return{ok:false,error:_0x1641f1||_0xd1('TsOjbyBjb25zZWd1aSBlbmNvbnRyYXIgc2V1IHdvcmtzcGFjZSBMb3ZhYmxlLg=='),status:_0x28bef1,details:_0x28bff1};
}
const _0x28c0f1=_0x28bdf1.find(_0x16f7f1=>!/free/i.test(String(_0x16f7f1.plan||'')))||_0x28bdf1[0];
const workspaceId=_0x28c0f1.id;
const _0x28c1f1=title||(_0xd1('UHJvamV0byA=')+new Date().toLocaleString(_0xd1('cHQtQlI=')));
const _0x28c2f1=[
{description:_0x28c1f1,tech_stack:_0xd1('bW9kZXJu'),visibility:_0xd1('cHJpdmF0ZQ=='),metadata:{chat_mode_enabled:true,fullscreen_enabled:true}},
{description:_0x28c1f1,visibility:_0xd1('cHJpdmF0ZQ=='),metadata:{fullscreen_enabled:true}},
];
const _0x28c3f1=[_0x28b1f1+_0xd1('L3YxL3dvcmtzcGFjZXMv')+encodeURIComponent(workspaceId)+_0xd1('L3Byb2plY3Rz'),_0x28b1f1+_0xd1('L3dvcmtzcGFjZXMv')+encodeURIComponent(workspaceId)+_0xd1('L3Byb2plY3Rz')];
let _0x28c4f1=null;
for(const url of _0x28c3f1){
for(const _0x1e4af1 of _0x28c2f1){
try{
const _0x1f3ff1=await fetch(url,{method:_0xd1('UE9TVA=='),headers:await _0x28baf1(true),credentials:_0xd1('aW5jbHVkZQ=='),body:JSON.stringify(_0x1e4af1)});
const data=await _0x28b3f1(_0x1f3ff1);
_0x28c4f1={status:_0x1f3ff1.status,data,url};
if(_0x1f3ff1.ok){
const _0x1f2bf1=data.project||data.data||data;
const _0x1f2cf1=_0x1f2bf1.id||_0x1f2bf1.project_id||data.id||data.projectId;
const link=_0x1f2bf1.editor_url||_0x1f2bf1.url||_0x1f2bf1.link||data.editor_url||data.url||data.link||(_0x1f2cf1?_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi9wcm9qZWN0cy8=')+_0x1f2cf1:_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi8='));
return{ok:true,success:true,link,projectId:_0x1f2cf1||'',workspaceId,data};
}
if(_0x1f3ff1.status!==400&&_0x1f3ff1.status!==404&&_0x1f3ff1.status!==422)break;
}catch(_0x1f41f1){_0x28c4f1={status:0,data:{error:_0x1f41f1.message},url};}
}
}
const _0x28c5f1=(_0x28c4f1&&_0x28c4f1.data&&(_0x28c4f1.data.message||_0x28c4f1.data.error||_0x28c4f1.data.type))||_0xd1('RmFsaGEgYW8gY3JpYXIgcHJvamV0byBubyBMb3ZhYmxlLg==');
if(_0x28c4f1&&_0x28c4f1.status===401)return{ok:false,status:401,error:_0xd1('U3VhIHNlc3PDo28gZG8gTG92YWJsZSBuw6NvIGF1dG9yaXpvdSBhIGNyaWHDp8Ojby4gQXR1YWxpemUgYSBhYmEgZG8gTG92YWJsZS5kZXYsIGNvbmZpcm1lIHF1ZSBlc3TDoSBsb2dhZG8gZSB0ZW50ZSBub3ZhbWVudGUu'),details:_0x28c4f1};
if(_0x28c4f1&&_0x28c4f1.status===402)return{ok:false,status:402,error:_0xd1('U3VhIGNvbnRhIExvdmFibGUgcHJlY2lzYSB0ZXIgY3LDqWRpdG9zL3BsYW5vIGRpc3BvbsOtdmVsIHBhcmEgY3JpYXIgcHJvamV0by4='),details:_0x28c4f1};
if(/castle|denied|captcha/i.test(String(_0x28c5f1)))return{ok:false,status:_0x28c4f1&&_0x28c4f1.status,error:_0xd1('TyBMb3ZhYmxlIGJsb3F1ZW91IGEgYXV0b21hw6fDo28gcG9yIHNlZ3VyYW7Dp2EuIEF0dWFsaXplIGEgYWJhIGRvIExvdmFibGUuZGV2IGUgdGVudGUgbm92YW1lbnRlLg=='),details:_0x28c4f1};
return{ok:false,status:_0x28c4f1&&_0x28c4f1.status,error:_0x28c5f1,details:_0x28c4f1};
},
args:[{token,title:_0x29c5f1.title||''}],
});
const _0x29bff1=(_0x29bef1&&_0x29bef1[0]&&_0x29bef1[0].result)||{ok:false,error:_0xd1('c2VtIHJlc3Bvc3RhIGRhIHDDoWdpbmEgTG92YWJsZQ==')};
if(_0x29bff1&&_0x29bff1.ok&&_0x29bff1.projectId){
chrome.storage.local.set({lovable_projectId:_0x29bff1.projectId});
}
_0x29c7f1(_0x29bff1);
}catch(_0x29c1f1){
console.error(_0xd1('W0JhY2tncm91bmRdIGNyZWF0ZUxvdmFibGVQcm9qZWN0SW5QYWdlIGVycm9yOg=='),_0x29c1f1);
_0x29c7f1({ok:false,error:_0x29c1f1.message||_0xd1('RmFsaGEgYW8gY3JpYXIgcGVsYSBhYmEgTG92YWJsZS4=')});
}
})();
return true;
});
chrome.runtime.onMessage.addListener((_0x2cf4f1,_0x2cf5f1,_0x2cf6f1)=>{
if(!_0x2cf4f1||_0x2cf4f1.action!==_0xd1('b3Blbk5hdGl2ZUxvdmFibGVQdWJsaXNo'))return;
(async()=>{
try{
let _0x2cecf1=null;
const _0x2cedf1=await chrome.tabs.query({active:true,currentWindow:true});
if(_0x2cedf1&&_0x2cedf1[0]&&/^https:\/\/([^/]+\.)?lovable\.dev\//.test(_0x2cedf1[0].url||""))_0x2cecf1=_0x2cedf1[0];
if(!_0x2cecf1){
const _0x2aa6f1=await chrome.tabs.query({url:[_0xd1('aHR0cHM6Ly9sb3ZhYmxlLmRldi8q'),_0xd1('aHR0cHM6Ly8qLmxvdmFibGUuZGV2Lyo=')]});
_0x2cecf1=_0x2aa6f1&&_0x2aa6f1[0];
}
if(!_0x2cecf1||!_0x2cecf1.id)return _0x2cf6f1({ok:false,error:_0xd1('QWJyYSBvIHByb2pldG8gbm8gTG92YWJsZSBhbnRlcyBkZSBwdWJsaWNhci4=')});
const _0x2ceef1=await chrome.scripting.executeScript({
target:{tabId:_0x2cecf1.id},world:_0xd1('TUFJTg=='),
func:()=>{
const _0x2ca8f1=_0x2b55f1=>!!(_0x2b55f1&&_0x2b55f1.getClientRects&&_0x2b55f1.getClientRects().length&&getComputedStyle(_0x2b55f1).visibility!==_0xd1('aGlkZGVu'));
const _0x2ca9f1=_0x2b83f1=>((_0x2b83f1.innerText||_0x2b83f1.textContent||_0x2b83f1.getAttribute(_0xd1('YXJpYS1sYWJlbA=='))||_0x2b83f1.getAttribute(_0xd1('dGl0bGU='))||'')+'').trim().toLowerCase();
const _0x2caaf1=Array.from(document.querySelectorAll(_0xd1('YnV0dG9uLFtyb2xlPSJidXR0b24iXSxh')));
const _0x2cabf1=_0x2caaf1.filter(_0x2ca8f1).find(_0x2c2ff1=>{
const _0x2c30f1=_0x2ca9f1(_0x2c2ff1);
return _0x2c30f1===_0xd1('cHVibGlzaA==')||_0x2c30f1===_0xd1('cHVibGljYXI=')||/^publish\b/.test(_0x2c30f1)||/^publicar\b/.test(_0x2c30f1);
});
if(_0x2cabf1){_0x2cabf1.click();return{ok:true};}
const _0x2cacf1=_0x2caaf1.filter(_0x2ca8f1).find(_0x2c7af1=>/publish|publicar/.test(_0x2ca9f1(_0x2c7af1)));
if(_0x2cacf1){_0x2cacf1.click();return{ok:true};}
return{ok:false,error:_0xd1('Qm90w6NvIG5hdGl2byBQdWJsaWNhciBuw6NvIGVuY29udHJhZG8gbmVzdGEgdGVsYS4=')};
}
});
_0x2cf6f1((_0x2ceef1&&_0x2ceef1[0]&&_0x2ceef1[0].result)||{ok:false,error:_0xd1('U2VtIHJlc3Bvc3RhIGRhIHDDoWdpbmEu')});
}catch(_0x2cf0f1){_0x2cf6f1({ok:false,error:_0x2cf0f1.message||_0xd1('RmFsaGEgYW8gYWJyaXIgUHVibGljYXIu')});}
})();
return true;
});


/* ===== OFERROLGARCIA — Camada de Licenciamento ===== */
async function openLicenseScreen(){
  const url = chrome.runtime.getURL('license.html');
  try{
    const tabs = await chrome.tabs.query({url});
    if(tabs && tabs[0]){
      await chrome.tabs.update(tabs[0].id,{active:true});
      try{ await chrome.windows.update(tabs[0].windowId,{focused:true}); }catch(_){}
      return;
    }
  }catch(_){}
  await chrome.tabs.create({url});
}

async function broadcastLicense(licensed){
  try{
    const tabs = await chrome.tabs.query({url:['https://lovable.dev/*','https://*.lovable.dev/*']});
    for(const t of (tabs||[])){
      chrome.tabs.sendMessage(t.id,{type:'OG_LICENSE_CHANGED',licensed:!!licensed},()=>void chrome.runtime.lastError);
    }
  }catch(_){}
}

/** Após validar: atualiza (recarrega) a Lovable e abre a extensão. */
async function reloadLovableAndOpen(){
  try{
    await broadcastLicense(true);
    const tabs = await chrome.tabs.query({url:['https://lovable.dev/*','https://*.lovable.dev/*']});
    let target = tabs && tabs[0];
    if(target){
      await chrome.tabs.reload(target.id);
      await chrome.tabs.update(target.id,{active:true});
      try{ await chrome.windows.update(target.windowId,{focused:true}); }catch(_){}
    }else{
      target = await chrome.tabs.create({url:'https://lovable.dev/',active:true});
    }
    const tabId = target.id;
    const onDone = (id,info)=>{
      if(id!==tabId || info.status!=='complete') return;
      chrome.tabs.onUpdated.removeListener(onDone);
      setTimeout(()=>{
        chrome.tabs.sendMessage(tabId,{type:'OG_LICENSE_CHANGED',licensed:true},()=>void chrome.runtime.lastError);
        chrome.tabs.sendMessage(tabId,{type:'OFG_OPEN_FLOATING_UI'},()=>void chrome.runtime.lastError);
      },900);
    };
    chrome.tabs.onUpdated.addListener(onDone);
  }catch(e){ console.error('[OG] reloadLovableAndOpen',e); }
}

chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(!msg||!msg.type) return;
  if(msg.type==='OG_LICENSE_STATUS'){
    self.OGLicense.refresh(false).then(r=>sendResponse({licensed:!!(r&&r.ok)})).catch(()=>sendResponse({licensed:false}));
    return true;
  }
  if(msg.type==='OG_OPEN_LICENSE'){ openLicenseScreen(); sendResponse&&sendResponse({ok:true}); return; }
  if(msg.type==='OG_LICENSE_OK'){ reloadLovableAndOpen(); sendResponse&&sendResponse({ok:true}); return; }
});

chrome.runtime.onInstalled.addListener(async()=>{
  try{
    const r = await self.OGLicense.refresh(true);
    if(!r||!r.ok) openLicenseScreen();
  }catch(_){ openLicenseScreen(); }
  try{ chrome.alarms.create('og-license-heartbeat',{periodInMinutes:15}); }catch(_){}
});
chrome.runtime.onStartup && chrome.runtime.onStartup.addListener(()=>{
  try{ chrome.alarms.create('og-license-heartbeat',{periodInMinutes:15}); }catch(_){}
});
chrome.alarms && chrome.alarms.onAlarm.addListener(async(a)=>{
  if(a.name!=='og-license-heartbeat') return;
  try{
    const r = await self.OGLicense.refresh(true);
    await broadcastLicense(!!(r&&r.ok));
    if(!r||!r.ok) openLicenseScreen();
  }catch(_){}
});
