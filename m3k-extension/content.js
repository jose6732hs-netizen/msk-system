var _0xd5=function(s){var b=atob(s),u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new TextDecoder().decode(u)};
const OPTIMIZE_URL=_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEvb3B0aW1pemUtcHJvbXB0');
const PACKAGES_URL=_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9yZXN0L3YxL3BhY2thZ2VzP3NlbGVjdD0qJmlzX2FjdGl2ZT1lcS50cnVlJm9yZGVyPXNvcnRfb3JkZXIuYXNj');
const EXT_PAYMENT_URL=_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEvcHJvY2Vzcy1leHRlbnNpb24tcGF5bWVudA==');
const PROXY_COMMAND_URL=_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEvcHJveHktY29tbWFuZA==');
const REMOVE_WATERMARK_URL=_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEvcmVtb3ZlLXdhdGVybWFyaw==');
const PUBLISH_PROJECT_URL=_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEvcHVibGlzaC1wcm9qZWN0');
const PROMPT_IMAGE_PUBLIC_BASE_URL=_0xd5('aHR0cHM6Ly9leHRlbnNhb3NvcmF4LmxvdmFibGUuYXBw');
const SUPABASE_ANON_KEY=_0xd5('ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQmhZbUZ6WlNJc0luSmxaaUk2SW1oNWFuTmhhV0ZzWldKd2MydDNablpwYm1sbklpd2ljbTlzWlNJNkltRnViMjRpTENKcFlYUWlPakUzT0RRM01qRXlPVGNzSW1WNGNDSTZNakV3TURJNU56STVOMzAueFJ6eE1mcjkyeHhSeE13Z05HXzBpejlKMlJjNlNRVjNmTGdWS0l0SmdyZw==');
function cleanupLovablePromptLocks(){
try{chrome.storage.local.set({ql_shield_active:false,ql_native_chat:false,tsExtensionLayoutMode:_0xd5('c2lkZWJhcg==')});}catch(_0x2f5){}
try{
document.getElementById(_0xd5('cWwtc2hpZWxkLW92ZXJsYXk='))?.remove();
document.getElementById(_0xd5('cWwtbmF0aXZlLWJhZGdl'))?.remove();
document.getElementById(_0xd5('cWwtbmF0aXZlLXJldHVybi1idG4='))?.remove();
document.getElementById(_0xd5('cWwtbmF0aXZlLXNlbmRpbmctb3ZlcmxheQ=='))?.remove();
document.getElementById(_0xd5('dHMtbmF0aXZlLWJhZGdl'))?.remove();
document.getElementById(_0xd5('dHMtc2tpbGwtYmFkZ2U='))?.remove();
document.getElementById(_0xd5('dHMtcG9wdXAtYXR0YWNoLXByZXZpZXc='))?.remove();
document.getElementById(_0xd5('dHMtZmxvYXRpbmctbGF1bmNoZXI='))?.remove();
document.getElementById(_0xd5('dHMtZmxvYXRpbmctYWN0aW9uLW1lbnU='))?.remove();
document.getElementById(_0xd5('dHMtZmxvYXRpbmctc3VibWVudQ=='))?.remove();
document.body?.classList.remove(_0xd5('dHMtbmF0aXZlLWNoYXQtYWN0aXZl'));
document.querySelectorAll(_0xd5('LnRzLW5hdGl2ZS1jb21wb3Nlci13cmFw')).forEach(_0x84f5=>_0x84f5.classList.remove(_0xd5('dHMtbmF0aXZlLWNvbXBvc2VyLXdyYXA=')));
const _0x97f5=document.getElementById(_0xd5('Y2hhdGlucHV0LXNlbmQtbWVzc2FnZS1idXR0b24='));
if(_0x97f5){
_0x97f5.classList.remove(_0xd5('cWwtbmF0aXZlLXNlbmQtYWN0aXZl'),_0xd5('cWwtbmF0aXZlLXNlbmRpbmc='));
_0x97f5.style.animation='';
_0x97f5.disabled=false;
}
document.querySelectorAll(_0xd5('W2RhdGEtcWwtc2hpZWxkLWRpc2FibGVkXQ==')).forEach(_0xc1f5=>{
delete _0xc1f5.dataset.qlShieldDisabled;
delete _0xc1f5.dataset.qlShieldTabindex;
delete _0xc1f5.dataset.qlShieldEditable;
_0xc1f5.removeAttribute(_0xd5('dGFiaW5kZXg='));
if(_0xc1f5.contentEditable===_0xd5('ZmFsc2U='))_0xc1f5.contentEditable=_0xd5('dHJ1ZQ==');
});
}catch(_0xc3f5){}
}
cleanupLovablePromptLocks();
setInterval(cleanupLovablePromptLocks,1000);
if(document.readyState===_0xd5('bG9hZGluZw==')){
document.addEventListener(_0xd5('RE9NQ29udGVudExvYWRlZA=='),cleanupLovablePromptLocks,{once:true});
}else{
cleanupLovablePromptLocks();
}
function normalizePromptImageUrl(_0xcdf5){
return String(_0xcdf5||'');
}
window.__tsSidebarCollapsed=window.__tsSidebarCollapsed||false;
function injectSidebarCollapseFloatingButton(){
if(window.top!==window)return;
if(document.getElementById(_0xd5('dHMtc2lkZWJhci1jb2xsYXBzZS1mbG9hdGluZy1idXR0b24='))){
return;
}
const _0x137f5=document.createElement(_0xd5('YnV0dG9u'));
_0x137f5.id=_0xd5('dHMtc2lkZWJhci1jb2xsYXBzZS1mbG9hdGluZy1idXR0b24=');
_0x137f5.type=_0xd5('YnV0dG9u');
_0x137f5.textContent="›";
_0x137f5.title=_0xd5('UmVjb2xoZXIgZXh0ZW5zw6Nv');
_0x137f5.style.cssText=[
_0xd5('cG9zaXRpb246IGZpeGVkICFpbXBvcnRhbnQ='),
_0xd5('dG9wOiA1MCUgIWltcG9ydGFudA=='),
_0xd5('cmlnaHQ6IDM4MHB4ICFpbXBvcnRhbnQ='),
_0xd5('dHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpICFpbXBvcnRhbnQ='),
_0xd5('d2lkdGg6IDI4cHggIWltcG9ydGFudA=='),
_0xd5('aGVpZ2h0OiA1MnB4ICFpbXBvcnRhbnQ='),
_0xd5('ei1pbmRleDogMjE0NzQ4MzY0NyAhaW1wb3J0YW50'),
_0xd5('ZGlzcGxheTogZmxleCAhaW1wb3J0YW50'),
_0xd5('b3BhY2l0eTogMSAhaW1wb3J0YW50'),
_0xd5('dmlzaWJpbGl0eTogdmlzaWJsZSAhaW1wb3J0YW50'),
_0xd5('cG9pbnRlci1ldmVudHM6IGF1dG8gIWltcG9ydGFudA=='),
_0xd5('YWxpZ24taXRlbXM6IGNlbnRlciAhaW1wb3J0YW50'),
_0xd5('anVzdGlmeS1jb250ZW50OiBjZW50ZXIgIWltcG9ydGFudA=='),
_0xd5('Ym9yZGVyOiBub25lICFpbXBvcnRhbnQ='),
_0xd5('Ym9yZGVyLXJhZGl1czogMTJweCAwIDAgMTJweCAhaW1wb3J0YW50'),
_0xd5('Y3Vyc29yOiBwb2ludGVyICFpbXBvcnRhbnQ='),
_0xd5('YmFja2dyb3VuZDogIzNCODJGNiAhaW1wb3J0YW50'),
_0xd5('Y29sb3I6ICNmZmZmZmYgIWltcG9ydGFudA=='),
_0xd5('Ym94LXNoYWRvdzogLTRweCA0cHggMTRweCByZ2JhKDAsIDAsIDAsIDAuMTgpICFpbXBvcnRhbnQ='),
_0xd5('Zm9udC1zaXplOiAxNnB4ICFpbXBvcnRhbnQ='),
_0xd5('Zm9udC13ZWlnaHQ6IDcwMCAhaW1wb3J0YW50'),
_0xd5('cGFkZGluZzogMCAhaW1wb3J0YW50'),
_0xd5('bWFyZ2luOiAwICFpbXBvcnRhbnQ='),
_0xd5('dHJhbnNpdGlvbjogcmlnaHQgMjgwbXMgZWFzZSAhaW1wb3J0YW50')
].join("; ")+";";
_0x137f5.addEventListener(_0xd5('Y2xpY2s='),()=>{
window.postMessage(
{
type:_0xd5('VFNfVE9HR0xFX0VYVEVOU0lPTl9TSURFQkFS')
},
"*"
);
});
document.body.appendChild(_0x137f5);
console.info(_0xd5('W1RTIEV4dGVuc2lvbl0gRmxvYXRpbmcgc2lkZWJhciBidXR0b24gaW5qZWN0ZWQ='));
}
function updateSidebarCollapseFloatingButtonUI(_0x22bf5){
const _0x22cf5=document.getElementById(_0xd5('dHMtc2lkZWJhci1jb2xsYXBzZS1mbG9hdGluZy1idXR0b24='));
if(!_0x22cf5)return;
const _0x22df5=window.__tsExtensionLayoutMode||_0xd5('c2lkZWJhcg==');
if(_0x22df5===_0xd5('cG9wdXA=')||_0x22df5===_0xd5('ZmxvYXRpbmc=')){
_0x22cf5.style.setProperty(_0xd5('ZGlzcGxheQ=='),_0xd5('bm9uZQ=='),_0xd5('aW1wb3J0YW50'));
return;
}
_0x22cf5.style.setProperty(_0xd5('ZGlzcGxheQ=='),_0xd5('ZmxleA=='),_0xd5('aW1wb3J0YW50'));
_0x22cf5.style.setProperty(_0xd5('cmlnaHQ='),_0x22bf5?"0":_0xd5('MzgwcHg='),_0xd5('aW1wb3J0YW50'));
_0x22cf5.textContent=_0x22bf5?"‹":"›";
_0x22cf5.title=_0x22bf5?_0xd5('QWJyaXIgZXh0ZW5zw6Nv'):_0xd5('UmVjb2xoZXIgZXh0ZW5zw6Nv');
_0x22cf5.setAttribute(_0xd5('YXJpYS1sYWJlbA=='),_0x22cf5.title);
}
function setSidebarCollapseFloatingButtonState(_0x243f5){
window.__tsSidebarCollapsed=Boolean(_0x243f5);
injectSidebarCollapseFloatingButton();
updateSidebarCollapseFloatingButtonUI(window.__tsSidebarCollapsed);
try{
chrome.storage.local.set({sidebarCollapsed:window.__tsSidebarCollapsed});
}catch(_0x245f5){}
}
window.addEventListener(_0xd5('bWVzc2FnZQ=='),(_0x264f5)=>{
if(_0x264f5.source!==window)return;
if(!_0x264f5.data||_0x264f5.data.type!==_0xd5('VFNfVE9HR0xFX0VYVEVOU0lPTl9TSURFQkFS'))return;
setSidebarCollapseFloatingButtonState(!window.__tsSidebarCollapsed);
});
if(document.readyState===_0xd5('bG9hZGluZw==')){
document.addEventListener(
_0xd5('RE9NQ29udGVudExvYWRlZA=='),
injectSidebarCollapseFloatingButton
);
}else{
injectSidebarCollapseFloatingButton();
}
const sidebarButtonObserver=new MutationObserver(()=>{
if(!document.getElementById(_0xd5('dHMtc2lkZWJhci1jb2xsYXBzZS1mbG9hdGluZy1idXR0b24='))){
injectSidebarCollapseFloatingButton();
}
});
sidebarButtonObserver.observe(document.documentElement,{
childList:true,
subtree:true
});
try{
chrome.storage.local.get({sidebarCollapsed:false,tsExtensionLayoutMode:_0xd5('c2lkZWJhcg==')},(_0x288f5)=>{
window.__tsSidebarCollapsed=Boolean(_0x288f5&&_0x288f5.sidebarCollapsed);
window.__tsExtensionLayoutMode=(_0x288f5&&_0x288f5.tsExtensionLayoutMode)||_0xd5('c2lkZWJhcg==');
injectSidebarCollapseFloatingButton();
updateSidebarCollapseFloatingButtonUI(window.__tsSidebarCollapsed);
});
chrome.storage.onChanged.addListener((_0x2b9f5,_0x2baf5)=>{
if(_0x2baf5!==_0xd5('bG9jYWw='))return;
if(_0x2b9f5.sidebarCollapsed){
window.__tsSidebarCollapsed=Boolean(_0x2b9f5.sidebarCollapsed.newValue);
}
if(_0x2b9f5.tsExtensionLayoutMode){
window.__tsExtensionLayoutMode=_0x2b9f5.tsExtensionLayoutMode.newValue||_0xd5('c2lkZWJhcg==');
}
if(_0x2b9f5.sidebarCollapsed||_0x2b9f5.tsExtensionLayoutMode){
injectSidebarCollapseFloatingButton();
updateSidebarCollapseFloatingButtonUI(window.__tsSidebarCollapsed);
}
});
}catch(_0x2bcf5){}
function escapeHtml(_0x2f5f5){
if(!_0x2f5f5)return'';
const _0x2f6f5=document.createElement('div');
_0x2f6f5.textContent=String(_0x2f5f5);
return _0x2f6f5.innerHTML;
}
function sanitizeUrl(_0x300f5){
if(!_0x300f5)return'';
try{
const _0x317f5=new URL(_0x300f5);
if(_0x317f5.protocol===_0xd5('aHR0cDo=')||_0x317f5.protocol===_0xd5('aHR0cHM6'))return _0x300f5;
return'';
}catch(_0x319f5){return'';}
}
function decodeJwtPayload(_0x31ef5){
try{
const _0x447f5=String(_0x31ef5||'').replace(/^Bearer\s+/i,'').trim();
const _0x448f5=_0x447f5.split('.');
if(_0x448f5.length<2)return null;
const _0x449f5=_0x448f5[1].replace(/-/g,'+').replace(/_/g,'/');
const _0x44af5=_0x449f5+'='.repeat((4-(_0x449f5.length%4))%4);
return JSON.parse(atob(_0x44af5));
}catch(_0x44cf5){
return null;
}
}
async function sendPromptNativeViaBackground(_0x177cf5,_0x177df5,_0x177ef5){
const _0x177ff5=Array.isArray(_0x177ef5)?_0x177ef5:qlAttachedFiles;
const _0x1780f5=await new Promise((_0x5caf5)=>chrome.storage.local.get([_0xd5('bG92YWJsZV90b2tlbg=='),_0xd5('bG92YWJsZV9wcm9qZWN0SWQ=')],_0x5caf5));
let _0x1781f5=_0x1780f5.lovable_token||'';
const _0x1782f5=_0x1780f5.lovable_projectId||'';
if(_0x1781f5.startsWith(_0xd5('QmVhcmVyIA==')))_0x1781f5=_0x1781f5.slice(7);
if(!_0x1782f5){
throw new Error(_0xd5('UHJvamV0byBMb3ZhYmxlIG7Do28gaWRlbnRpZmljYWRvLg=='));
}
if(!_0x1781f5){
throw new Error(_0xd5('VG9rZW4gTG92YWJsZSBuw6NvIGVuY29udHJhZG8uIEZhw6dhIGxvZ2luIG5vdmFtZW50ZSBuYSBMb3ZhYmxlLg=='));
}
const _0x1783f5=String(_0x177cf5||'').trim();
const _0x1784f5=(_0x8eef5)=>new Promise((_0x94ff5,_0x950f5)=>{
const _0x951f5=new FileReader();
_0x951f5.onload=()=>{const _0x930f5=String(_0x951f5.result||'');_0x94ff5(_0x930f5.split(',')[1]||'');};
_0x951f5.onerror=()=>_0x950f5(new Error(_0xd5('RmFsaGEgYW8gbGVyIGFycXVpdm8=')));
_0x951f5.readAsDataURL(_0x8eef5);
});
const _0x1785f5=[];
const _0x1786f5=[];
for(const _0x1787f5 of _0x177ff5){
if(_0x1787f5.uploading&&!_0x1787f5.rawFile)continue;
const _0xb96f5=_0x1787f5.rawFile;
if(!_0xb96f5)continue;
const _0xb97f5=_0x1787f5.file_name||_0xb96f5.name||_0xd5('ZmlsZQ==');
const _0xb98f5=(_0xb96f5.type||_0x1787f5.file_type||'').toLowerCase();
const _0xb99f5=_0xb98f5===_0xd5('YXBwbGljYXRpb24vemlw')||_0xb98f5===_0xd5('YXBwbGljYXRpb24veC16aXAtY29tcHJlc3NlZA==')||/\.zip$/i.test(_0xb97f5);
let _0xb9af5='';
try{_0xb9af5=await _0x1784f5(_0xb96f5);}catch(_0xb7cf5){console.warn(_0xd5('W1FMIElubGluZSBTZW5kXSBGYWxoYSBhbyBsZXIgYW5leG86'),_0xb97f5,_0xb7cf5);continue;}
if(!_0xb9af5)continue;
if(_0xb99f5){
_0x1786f5.push({file_name:_0xb97f5,content_type:_0xd5('YXBwbGljYXRpb24veC16aXAtY29tcHJlc3NlZA=='),data_base64:_0xb9af5});
}else{
_0x1785f5.push({name:_0xb97f5,file_name:_0xb97f5,content_type:_0xb98f5||_0xd5('aW1hZ2UvcG5n'),data_base64:_0xb9af5});
}
}
const _0x1788f5={
token:_0x1781f5,
projectId:_0x1782f5,
message:_0x1783f5,
files:_0x1785f5,
zipFiles:_0x1786f5,
attachedFiles:[],
current_page:(typeof location!==_0xd5('dW5kZWZpbmVk')?location.pathname:'/')||'/',
current_viewport_width:(typeof window!==_0xd5('dW5kZWZpbmVk')&&window.innerWidth)||1336,
current_viewport_height:(typeof window!==_0xd5('dW5kZWZpbmVk')&&window.innerHeight)||861,
current_viewport_dpr:(typeof window!==_0xd5('dW5kZWZpbmVk')&&window.devicePixelRatio)||1,
};
if(_0x177ff5.some(_0x1071f5=>_0x1071f5&&_0x1071f5.rawFile)&&(_0x1785f5.length+_0x1786f5.length)===0){
throw new Error(_0xd5('QXJxdWl2byBhbmV4YWRvLCBtYXMgbsOjbyBlbnRyb3Ugbm8gcGF5bG9hZCBpbmxpbmUu'));
}
const _0x1789f5=await bgFetchRaw(
_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEvc2VuZC1sb3ZhYmxlLXByb21wdA=='),
{
method:_0xd5('UE9TVA=='),
headers:{
'Content-Type':_0xd5('YXBwbGljYXRpb24vanNvbg=='),
'apikey':SUPABASE_ANON_KEY,
'Authorization':_0xd5('QmVhcmVyIA==')+SUPABASE_ANON_KEY,
},
body:JSON.stringify(_0x1788f5),
}
);
const _0x178af5=_0x1789f5&&_0x1789f5.data?_0x1789f5.data:{};
const _0x178bf5=_0x178af5.status||_0x1789f5.status;
if(_0x178bf5===401||_0x178bf5===403){
throw new Error(_0xd5('U2Vzc8OjbyBMb3ZhYmxlIGV4cGlyYWRhLiBSZWNhcnJlZ3VlIGEgcMOhZ2luYSBlIHRlbnRlIG5vdmFtZW50ZS4='));
}
if(_0x178bf5===402){
throw new Error(_0xd5('Vm9jw6ogcHJlY2lzYSB0ZXIgcGVsbyBtZW5vcyAxIGNyw6lkaXRvIG5hIHN1YSBjb250YSBMb3ZhYmxlLg=='));
}
if(!_0x1789f5||!_0x1789f5.ok||_0x178af5.ok===false||_0x178af5.success===false){
const _0x169bf5=
(_0x178af5&&(_0x178af5.error||(_0x178af5.data&&(_0x178af5.data.error||_0x178af5.data.message))))||
(_0xd5('RXJybyA=')+(_0x178bf5||_0x1789f5?.status||_0xd5('ZGVzY29uaGVjaWRv'))+_0xd5('IGFvIGVudmlhciB2aWEgZWRnZSBmdW5jdGlvbg=='));
throw new Error(_0x169bf5);
}
return{success:true,method:_0xd5('ZWRnZV9zZW5kX2xvdmFibGVfcHJvbXB0'),data:_0x178af5.data||_0x178af5};
}
function bgFetch(url,_0x1795f5={}){
return new Promise((_0x17e2f5,_0x17e3f5)=>{
chrome.runtime.sendMessage({
action:_0xd5('cHJveHlGZXRjaA=='),
url,
method:_0x1795f5.method||_0xd5('UE9TVA=='),
headers:_0x1795f5.headers||{},
body:_0x1795f5.body||null,
},(_0x17fff5)=>{
if(chrome.runtime.lastError){
console.error(_0xd5('W2JnRmV0Y2hdIHJ1bnRpbWUgZXJyb3I6'),chrome.runtime.lastError.message);
return _0x17e3f5(new Error(chrome.runtime.lastError.message));
}
if(!_0x17fff5){
return _0x17e3f5(new Error(_0xd5('U2VtIHJlc3Bvc3RhIGRvIGJhY2tncm91bmQ=')));
}
if(_0x17fff5.data&&typeof _0x17fff5.data===_0xd5('b2JqZWN0')){
_0x17e2f5(_0x17fff5.data);
}else if(!_0x17fff5.ok){
_0x17e3f5(new Error(_0xd5('RmV0Y2ggZmFpbGVkIHZpYSBiYWNrZ3JvdW5kIChzdGF0dXMg')+_0x17fff5.status+")"));
}else{
_0x17e2f5(_0x17fff5.data);
}
});
});
}
function bgFetchRaw(url,_0x1809f5={}){
return new Promise((_0x1856f5,_0x1857f5)=>{
chrome.runtime.sendMessage({
action:_0xd5('cHJveHlGZXRjaA=='),
url,
method:_0x1809f5.method||_0xd5('UE9TVA=='),
headers:_0x1809f5.headers||{},
body:_0x1809f5.body||null,
},(_0x1879f5)=>{
if(chrome.runtime.lastError)return _0x1857f5(new Error(chrome.runtime.lastError.message));
if(!_0x1879f5)return _0x1857f5(new Error(_0xd5('U2VtIHJlc3Bvc3RhIGRvIGJhY2tncm91bmQ=')));
_0x1856f5(_0x1879f5);
});
});
}
function lovableApiFetch(url,_0x1883f5={}){
return new Promise((_0x18d0f5,_0x18d1f5)=>{
chrome.runtime.sendMessage({
action:_0xd5('bG92YWJsZUFwaUZldGNo'),
url,
method:_0x1883f5.method||_0xd5('UE9TVA=='),
headers:_0x1883f5.headers||{},
body:_0x1883f5.body||null,
},(_0x18f3f5)=>{
if(chrome.runtime.lastError)return _0x18d1f5(new Error(chrome.runtime.lastError.message));
if(!_0x18f3f5)return _0x18d1f5(new Error(_0xd5('U2VtIHJlc3Bvc3RhIGRvIGJhY2tncm91bmQ=')));
_0x18d0f5(_0x18f3f5);
});
});
}
(function _0x18f7f5(){
try{
const _0x1921f5=document.createElement(_0xd5('c2NyaXB0'));
_0x1921f5.src=chrome.runtime.getURL(_0xd5('cGFnZUhvb2suanM='));
_0x1921f5.onload=()=>_0x1921f5.remove();
(document.documentElement||document.head||document.body).appendChild(_0x1921f5);
}catch(_0x1923f5){
console.warn(_0xd5('W0NvbnRlbnRTY3JpcHRdIGZhbGhhIGFvIGluamV0YXIgcGFnZUhvb2s='),_0x1923f5);
}
})();
(function _0x1927f5(){
try{
window.addEventListener(_0xd5('bWVzc2FnZQ=='),(_0x197cf5)=>{
const _0x197df5=_0x197cf5.data;
if(!_0x197df5||typeof _0x197df5!==_0xd5('b2JqZWN0'))return;
if(_0x197df5.type===_0xd5('VFNfUEFHRV9VUExPQURfVE9fR0NT')&&_0x197cf5.source!==window){
try{
window.postMessage({
type:_0xd5('VFNfUEFHRV9VUExPQURfVE9fR0NT'),
requestId:_0x197df5.requestId,
uploadUrl:_0x197df5.uploadUrl,
contentType:_0x197df5.contentType,
arrayBuffer:_0x197df5.arrayBuffer
},"*");
}catch(_0x1965f5){console.warn(_0xd5('W1RTIFVwbG9hZF0gZm9yd2FyZCB0byBwYWdlIGZhaWxlZA=='),_0x1965f5);}
return;
}
if(_0x197df5.type===_0xd5('VFNfUEFHRV9VUExPQURfVE9fR0NTX1JFU1VMVA==')&&_0x197cf5.source===window){
try{
const _0x198cf5=document.getElementById(_0xd5('dHMtY29tbXVuaXR5LW92ZXJsYXktaWZyYW1l'));
if(_0x198cf5&&_0x198cf5.contentWindow){
_0x198cf5.contentWindow.postMessage(_0x197df5,"*");
}
}catch(_0x198ef5){console.warn(_0xd5('W1RTIFVwbG9hZF0gcmVsYXkgdG8gaWZyYW1lIGZhaWxlZA=='),_0x198ef5);}
}
});
}catch(_0x1990f5){console.warn(_0xd5('W0NvbnRlbnRTY3JpcHRdIGdjc1VwbG9hZEJyaWRnZSBmYWxob3U='),_0x1990f5);}
})();
(function _0x19c6f5(){
function _0x19c7f5(_0x19a4f5,_0x19a5f5){
try{window.postMessage({type:_0xd5('bG92YWJsZUF1dG9BcHByb3ZlQ29uZmln'),enabled:!!_0x19a4f5,reviewSubmit:!!_0x19a5f5},"*");}catch(_0x19a7f5){}
}
function _0x19c8f5(){
chrome.storage.local.get([_0xd5('c3BfYXV0b19hcHByb3Zl'),_0xd5('c3BfYXV0b19yZXZpZXdfc3VibWl0')],_0x19c5f5=>_0x19c7f5((_0x19c5f5&&typeof _0x19c5f5.sp_auto_approve!==_0xd5('dW5kZWZpbmVk'))?_0x19c5f5.sp_auto_approve:true,(_0x19c5f5&&typeof _0x19c5f5.sp_auto_review_submit!==_0xd5('dW5kZWZpbmVk'))?_0x19c5f5.sp_auto_review_submit:true));
}
try{
_0x19c8f5();
chrome.storage.onChanged.addListener((_0x1a07f5,_0x1a08f5)=>{
if(_0x1a08f5===_0xd5('bG9jYWw=')&&(_0x1a07f5.sp_auto_approve||_0x1a07f5.sp_auto_review_submit))_0x19c8f5();
});
let _0x1a1bf5=0;
const _0x1a1cf5=setInterval(()=>{
_0x1a1bf5++;
_0x19c8f5();
if(_0x1a1bf5>=5)clearInterval(_0x1a1cf5);
},800);
}catch(_0x1a1ef5){console.warn(_0xd5('W0NvbnRlbnRTY3JpcHRdIGF1dG9BcHByb3ZlQnJpZGdlIGZhbGhvdQ=='),_0x1a1ef5);}
})();
(function _0x1e08f5(){
let _0x1e09f5=true;
const _0x1e0af5=new WeakSet();
const _0x1e0bf5=[_0xd5('YXBwcm92ZQ=='),_0xd5('c3VibWl0'),_0xd5('Y29udGludWU='),_0xd5('Y29uZmlybQ=='),_0xd5('YXBwbHk=')];
function _0x1e0cf5(){
try{
chrome.storage.local.get([_0xd5('c3BfYXV0b19hcHByb3Zl')],_0x1b05f5=>{
_0x1e09f5=(_0x1b05f5&&typeof _0x1b05f5.sp_auto_approve!==_0xd5('dW5kZWZpbmVk'))?!!_0x1b05f5.sp_auto_approve:true;
});
}catch(_0x1b07f5){}
}
_0x1e0cf5();
try{
chrome.storage.onChanged.addListener((_0x1b46f5,_0x1b47f5)=>{
if(_0x1b47f5===_0xd5('bG9jYWw=')&&_0x1b46f5.sp_auto_approve){
_0x1e09f5=(typeof _0x1b46f5.sp_auto_approve.newValue!==_0xd5('dW5kZWZpbmVk'))
?!!_0x1b46f5.sp_auto_approve.newValue
:true;
}
});
}catch(_0x1b49f5){}
function _0x1e0df5(){
const _0x1b5df5=Array.from(document.querySelectorAll(_0xd5('YnV0dG9u')));
return _0x1b5df5.find((_0x1d00f5)=>{
const _0x1d01f5=(_0x1d00f5.innerText||_0x1d00f5.textContent||"").trim();
if(!_0x1d01f5)return false;
const _0x1d02f5=_0x1d01f5.toLowerCase();
if(!_0x1e0bf5.includes(_0x1d02f5))return false;
const _0x1d03f5=_0x1d00f5.offsetParent!==null&&!_0x1d00f5.disabled
&&_0x1d00f5.getAttribute(_0xd5('YXJpYS1kaXNhYmxlZA=='))!==_0xd5('dHJ1ZQ==');
if(!_0x1d03f5)return false;
let _0x1d04f5=false;
try{
const _0x1ce1f5=(_0x1d00f5.className&&_0x1d00f5.className.toString&&_0x1d00f5.className.toString())||"";
if(_0x1ce1f5.toLowerCase().includes(_0xd5('Ymx1ZQ==')))_0x1d04f5=true;
if(!_0x1d04f5){
const _0x1cf8f5=window.getComputedStyle(_0x1d00f5).backgroundColor||"";
if(_0x1cf8f5.includes("rgb"))_0x1d04f5=true;
}
}catch(_0x1cfaf5){}
return _0x1d04f5;
});
}
async function _0x1e0ef5(){
if(!_0x1e09f5)return false;
const _0x1da5f5=_0x1e0df5();
if(!_0x1da5f5)return false;
if(_0x1e0af5.has(_0x1da5f5))return false;
if(_0x1da5f5.dataset.tsAutoPromptSent===_0xd5('dHJ1ZQ=='))return false;
const _0x1da6f5=(_0x1da5f5.innerText||_0x1da5f5.textContent||"").trim();
if(!_0x1da6f5)return false;
_0x1e0af5.add(_0x1da5f5);
_0x1da5f5.dataset.tsAutoPromptSent=_0xd5('dHJ1ZQ==');
console.info(_0xd5('W1RTIEV4dGVuc2lvbl0gQXV0byBhY3Rpb24gZGV0ZWN0ZWQuIFNlbmRpbmcgYnV0dG9uIHRleHQgYXMgcHJvbXB0Og=='),_0x1da6f5);
try{
await sendPromptNativeViaBackground(_0x1da6f5,false,[]);
}catch(_0x1da2f5){
console.error(_0xd5('W1RTIEV4dGVuc2lvbl0gQXV0byBhY3Rpb24gc2VuZFByb21wdCBmYWlsZWQ6'),_0x1da2f5);
}
return true;
}
let _0x1e0ff5=false;
function _0x1e10f5(){
if(_0x1e0ff5)return;
_0x1e0ff5=true;
setTimeout(()=>{_0x1e0ff5=false;_0x1e0ef5();},500);
}
function _0x1e11f5(){
if(!document.body){setTimeout(_0x1e11f5,200);return;}
const _0x1df3f5=new MutationObserver(()=>{if(_0x1e09f5)_0x1e10f5();});
_0x1df3f5.observe(document.body,{childList:true,subtree:true});
console.info(_0xd5('W1RTIEV4dGVuc2lvbl0gQXV0byBhY3Rpb24gb2JzZXJ2ZXIgc3RhcnRlZA=='));
_0x1e10f5();
}
_0x1e11f5();
})();
let qlSessionId=null;
let qlHeartbeatInterval=null;
let qlUserName=null;
let qlExpiresAt=null;
let qlActivatedAt=null;
let qLicenseStatus=_0xd5('YWN0aXZl');
let qlOnlineCount=0;
let qlMinimized=false;
let qlHeight=520;
let qlSpeechRecognition=null;
let qlIsRecording=false;
let qlDeviceId=null;
let qlShieldActive=false;
let qlActiveTab=_0xd5('cHJvbXB0');
let qlChatHistory=[];
let qLicenseKey=null;
let qLicenseType=null;
let qLicenseLifetime=false;
const QL_HISTORY_KEY=_0xd5('cWxfY2hhdF9oaXN0b3J5');
const QL_MAX_HISTORY=200;
function getDeviceId(){
return getHardwareFingerprint();
}
function isTrialLicense(){
return(
qLicenseType===_0xd5('dHJpYWw=')||
(qLicenseKey&&qLicenseKey.startsWith(_0xd5('VFJJQUwt')))||
qLicenseStatus===_0xd5('dHJpYWw=')
);
}
function isLifetimeLicense(){
return(
qLicenseLifetime===true||
qLicenseLifetime===_0xd5('dHJ1ZQ==')||
(!qlExpiresAt&&qLicenseStatus===_0xd5('YWN0aXZl')&&qLicenseType!==_0xd5('dHJpYWw='))
);
}
function _buildFloatingUI(){
if(document.getElementById(_0xd5('cWwtZmxvYXRpbmc=')))return;
const _0x1e51f5=document.createElement("div");
_0x1e51f5.id=_0xd5('cWwtZmxvYXRpbmc=');
_0x1e51f5.style.left=Math.max(10,window.innerWidth-400)+"px";
_0x1e51f5.style.top=_0xd5('ODBweA==');
chrome.storage.local.get([_0xd5('cWxfbWluaW1pemVk'),_0xd5('cWxfaGVpZ2h0'),_0xd5('cWxfZGFya19tb2Rl')],_0x1e8ef5=>{
qlMinimized=_0x1e8ef5.ql_minimized||false;
qlHeight=_0x1e8ef5.ql_height||520;
if(_0x1e8ef5.ql_dark_mode===false)_0x1e51f5.classList.add(_0xd5('cWwtbGlnaHQ='));
if(qlMinimized)_0x1e51f5.classList.add(_0xd5('cWwtbWluaW1pemVk'));
document.body.appendChild(_0x1e51f5);
showMainUI(_0x1e51f5);
setupDrag();
setupResize();
});
}
function showMainUI(_0x1ff9f5){
const _0x1ffaf5=qlUserName||_0xd5('VXNlcg==');
const _0x1ffbf5=_0xd5('PHNwYW4gY2xhc3M9InFsLXN0YXR1cy1iYWRnZSBxbC1iYWRnZS1wcm8iPkFUSVZPPC9zcGFuPg==');
_0x1ff9f5.innerHTML=templateMainUI(_0x1ffaf5,_0x1ffbf5,qlMinimized);
removeLegacyControls(_0x1ff9f5);
_0x1ff9f5.style.height=qlHeight+"px";
setTimeout(()=>{
updateSyncStatus();
setupSend();
setupStorageWatch();
setupMinimize();
setupSuggestionChips();
setupWatermarkButton();
updateTrialCountdown();
setupDrag();
setupResize();
setupDarkMode();
setupOptimize();
setupSpeech();
setupNotifications();
setupModoPlano();
setupFileAttachment();
setupShield();
setupTabs();
loadChatHistory();
setupNativeChatButton();
setupClipboardPaste();
setupDownloadProject();
setupCreateProject();
setupPublishProject();
checkResellerRolePopup();
chrome.storage.local.get([_0xd5('cWxfbGljZW5zZV9rZXk='),_0xd5('cWxfc2Vzc2lvbl9pZA==')],(_0x1fb0f5)=>{
if(_0x1fb0f5.ql_license_key){
qlSessionId=_0x1fb0f5.ql_session_id||qlSessionId;
startHeartbeat(_0x1fb0f5.ql_license_key);
}
});
const _0x1ff7f5=document.getElementById(_0xd5('cWwtc2lkZXBhbmVsLWJ0bg=='));
if(_0x1ff7f5){
_0x1ff7f5.addEventListener(_0xd5('Y2xpY2s='),()=>{
const _0x1fdbf5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='));
if(_0x1fdbf5){
_0x1fdbf5.style.transition=_0xd5('b3BhY2l0eSAwLjNzIGVhc2UsIHRyYW5zZm9ybSAwLjNzIGVhc2U=');
_0x1fdbf5.style.opacity="0";
_0x1fdbf5.style.transform=_0xd5('dHJhbnNsYXRlWCgyMHB4KSBzY2FsZSgwLjk1KQ==');
}
chrome.runtime.sendMessage({action:_0xd5('YWN0aXZhdGVTaWRlYmFy')},(_0x1fe4f5)=>{
if(_0x1fe4f5&&_0x1fe4f5.ok){
setTimeout(()=>{
if(_0x1fdbf5)_0x1fdbf5.remove();
if(qlHeartbeatInterval)clearInterval(qlHeartbeatInterval);
if(window.qlCountdownInterval)clearInterval(window.qlCountdownInterval);
},350);
}else{
if(_0x1fdbf5){
_0x1fdbf5.style.opacity="1";
_0x1fdbf5.style.transform=_0xd5('bm9uZQ==');
}
showCustomAlert(_0xd5('RXJybw=='),_0xd5('TsOjbyBmb2kgcG9zc8OtdmVsIGFicmlyIG8gcGFpbmVsIGxhdGVyYWwuIFZlcmlmaXF1ZSBzZSBzZXUgbmF2ZWdhZG9yIHN1cG9ydGEgZXN0YSBmdW5jaW9uYWxpZGFkZS4='));
}
});
});
}
const _0x1ff8f5=document.getElementById(_0xd5('cWwtbG9nb3V0LWJ0bg=='));
if(_0x1ff8f5){
_0x1ff8f5.addEventListener(_0xd5('Y2xpY2s='),()=>{
if(qlHeartbeatInterval)clearInterval(qlHeartbeatInterval);
chrome.storage.local.remove([_0xd5('cWxfbGljZW5zZV92YWxpZA=='),_0xd5('cWxfbGljZW5zZV9rZXk='),_0xd5('cWxfc2Vzc2lvbl9pZA=='),_0xd5('cWxfdXNlcl9uYW1l'),_0xd5('cWxfZXhwaXJlc19hdA=='),_0xd5('cWxfYWN0aXZhdGVkX2F0'),_0xd5('cWxfbGljZW5zZV9zdGF0dXM=')],()=>{
qlUserName=null;qlExpiresAt=null;qlActivatedAt=null;qLicenseStatus=null;qlSessionId=null;qLicenseKey=null;
showMainUI(document.getElementById(_0xd5('cWwtZmxvYXRpbmc=')));
});
});
}
},30);
}
function removeLegacyControls(_0x1ff9f5){
if(!_0x1ff9f5)return;
const _0x1ffcf5=()=>{
_0x1ff9f5.querySelectorAll('#ql-optimize-btn,#ql-minimize,#sp-ui-optimize,#sp-ui-minimize,.og-minimize-action,.og-optimize-action').forEach(_0x1ffdf5=>_0x1ffdf5.remove());
_0x1ff9f5.querySelectorAll('button').forEach(_0x1ffd05=>{
const _0x1ffd15=(_0x1ffd05.textContent||'').trim().toLowerCase();
if(_0x1ffd15==='otimizar'||_0x1ffd15==='minimizar')_0x1ffd05.remove();
});
};
_0x1ffcf5();
if(!_0x1ff9f5.__ogControlsObserver){
_0x1ff9f5.__ogControlsObserver=new MutationObserver(_0x1ffcf5);
_0x1ff9f5.__ogControlsObserver.observe(_0x1ff9f5,{childList:true,subtree:true});
}
}
function showCustomAlert(_0x21a0f5,_0x21a1f5){
const _0x21a2f5=document.getElementById(_0xd5('cWwtY3VzdG9tLWFsZXJ0'));
if(!_0x21a2f5)return;
const _0x21a3f5=_0x21a2f5.querySelector(_0xd5('LnFsLWFsZXJ0LXRpdGxl'));
const _0x21a4f5=_0x21a2f5.querySelector(_0xd5('LnFsLWFsZXJ0LW1lc3NhZ2U='));
const _0x21a5f5=_0x21a2f5.querySelector(_0xd5('LnFsLWFsZXJ0LW9rLWJ0bg=='));
if(_0x21a3f5)_0x21a3f5.textContent=_0x21a0f5;
if(_0x21a4f5)_0x21a4f5.textContent=_0x21a1f5;
_0x21a2f5.style.display=_0xd5('ZmxleA==');
if(_0x21a5f5){
_0x21a5f5.onclick=()=>{_0x21a2f5.style.display=_0xd5('bm9uZQ==');};
}
setTimeout(()=>{_0x21a2f5.style.display=_0xd5('bm9uZQ==');},4000);
}
function setupOptimize(){
const _0x21baf5=document.getElementById(_0xd5('cWwtb3B0aW1pemUtYnRu'));
if(!_0x21baf5)return;
_0x21baf5.addEventListener(_0xd5('Y2xpY2s='),async()=>{
const _0x22b0f5=document.getElementById(_0xd5('cWwtbXNn'));
if(!_0x22b0f5||!_0x22b0f5.value.trim()){
showCustomAlert(_0xd5('QXRlbsOnw6Nv'),_0xd5('RGlnaXRlIHVtIHByb21wdCBhbnRlcyBkZSBvdGltaXphci4='));
return;
}
const _0x22b1f5=_0x22b0f5.value.trim();
_0x21baf5.classList.add(_0xd5('cWwtdG9vbC1sb2FkaW5n'));
_0x21baf5.disabled=true;
const _0x22b2f5=await new Promise(_0x228ff5=>chrome.storage.local.get([_0xd5('cWxfbGljZW5zZV9rZXk=')],_0x228ff5));
const _0x22b3f5=_0x22b2f5.ql_license_key||"";
try{
const _0x22ddf5=await bgFetch(OPTIMIZE_URL,{
method:_0xd5('UE9TVA=='),
headers:{
"Content-Type":_0xd5('YXBwbGljYXRpb24vanNvbg=='),
"apikey":SUPABASE_ANON_KEY,
"x-license-key":_0x22b3f5
},
body:JSON.stringify({prompt:_0x22b1f5})
});
if(_0x22ddf5.optimized_prompt){
_0x22b0f5.value=_0x22ddf5.optimized_prompt;
showCustomAlert(_0xd5('UHJvbXB0IE90aW1pemFkbyE='),_0xd5('U2V1IHByb21wdCBmb2kgYXByaW1vcmFkbyBjb20gSUEgZSBlc3TDoSBwcm9udG8gcGFyYSBlbnZpby4='));
}else if(_0x22ddf5.error){
showCustomAlert(_0xd5('RXJybw=='),_0x22ddf5.error);
}
}catch(_0x22dff5){
console.error(_0xd5('W09wdGltaXplXSBlcnJvOg=='),_0x22dff5);
showCustomAlert(_0xd5('RXJybw=='),_0xd5('RmFsaGEgYW8gY29uZWN0YXIgY29tIG8gb3RpbWl6YWRvcjog')+(_0x22dff5.message||""));
}finally{
_0x21baf5.classList.remove(_0xd5('cWwtdG9vbC1sb2FkaW5n'));
_0x21baf5.disabled=false;
}
});
}
function setupSpeech(){
const _0x2322f5=document.getElementById(_0xd5('cWwtc3BlZWNoLWJ0bg=='));
if(!_0x2322f5)return;
const _0x2323f5=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!_0x2323f5){
_0x2322f5.title=_0xd5('U3BlZWNoIG7Do28gc3Vwb3J0YWRvIG5lc3RlIG5hdmVnYWRvcg==');
_0x2322f5.style.opacity="0.4";
_0x2322f5.style.cursor=_0xd5('bm90LWFsbG93ZWQ=');
return;
}
_0x2322f5.addEventListener(_0xd5('Y2xpY2s='),(_0x2335f5)=>{
_0x2335f5.preventDefault();
_0x2335f5.stopPropagation();
if(qlIsRecording&&qlSpeechRecognition){
qlSpeechRecognition.stop();
return;
}
try{
qlSpeechRecognition=new _0x2323f5();
qlSpeechRecognition.lang=_0xd5('cHQtQlI=');
qlSpeechRecognition.continuous=true;
qlSpeechRecognition.interimResults=true;
qlSpeechRecognition.maxAlternatives=1;
let _0x245cf5="";
const _0x245df5=document.getElementById(_0xd5('cWwtbXNn'));
qlSpeechRecognition.onstart=()=>{
qlIsRecording=true;
_0x2322f5.classList.add(_0xd5('cWwtcmVjb3JkaW5n'));
_0x245cf5=_0x245df5?_0x245df5.value:"";
};
qlSpeechRecognition.onresult=(_0x2413f5)=>{
let _0x2414f5="";
for(let _0x2415f5=_0x2413f5.resultIndex;_0x2415f5<_0x2413f5.results.length;_0x2415f5++){
const _0x23f7f5=_0x2413f5.results[_0x2415f5][0].transcript;
if(_0x2413f5.results[_0x2415f5].isFinal){
_0x245cf5+=_0x23f7f5+" ";
}else{
_0x2414f5+=_0x23f7f5;
}
}
if(_0x245df5)_0x245df5.value=_0x245cf5+_0x2414f5;
};
qlSpeechRecognition.onerror=(_0x2449f5)=>{
console.warn(_0xd5('W1FMIFNwZWVjaF0gRXJybzo='),_0x2449f5.error);
qlIsRecording=false;
_0x2322f5.classList.remove(_0xd5('cWwtcmVjb3JkaW5n'));
if(_0x2449f5.error===_0xd5('bm90LWFsbG93ZWQ=')){
showCustomAlert(_0xd5('UGVybWlzc8OjbyBOZWdhZGE='),_0xd5('UGVybWl0YSBvIGFjZXNzbyBhbyBtaWNyb2ZvbmUgbmFzIGNvbmZpZ3VyYcOnw7VlcyBkbyBuYXZlZ2Fkb3Iu'));
}else if(_0x2449f5.error===_0xd5('bm8tc3BlZWNo')){
showCustomAlert(_0xd5('U2VtIMOBdWRpbw=='),_0xd5('TmVuaHVtYSBmYWxhIGRldGVjdGFkYS4gVGVudGUgbm92YW1lbnRlLg=='));
}else if(_0x2449f5.error!==_0xd5('YWJvcnRlZA==')){
showCustomAlert(_0xd5('RXJybyBkZSBWb3o='),_0xd5('RXJybzog')+_0x2449f5.error);
}
};
qlSpeechRecognition.onend=()=>{
qlIsRecording=false;
_0x2322f5.classList.remove(_0xd5('cWwtcmVjb3JkaW5n'));
if(_0x245df5)_0x245df5.value=_0x245cf5.trim();
};
qlSpeechRecognition.start();
}catch(_0x245ff5){
console.error(_0xd5('W1FMIFNwZWVjaF0gRmFsaGEgYW8gaW5pY2lhcjo='),_0x245ff5);
qlIsRecording=false;
_0x2322f5.classList.remove(_0xd5('cWwtcmVjb3JkaW5n'));
showCustomAlert(_0xd5('RXJybw=='),_0xd5('TsOjbyBmb2kgcG9zc8OtdmVsIGluaWNpYXIgbyByZWNvbmhlY2ltZW50byBkZSB2b3ou'));
}
});
}
function setupNotifications(){
const _0x253af5=document.querySelector(_0xd5('LnFsLW5vdGlmLWJ0bg=='));
const _0x253bf5=document.getElementById(_0xd5('cWwtbm90aWYtcGFuZWw='));
const _0x253cf5=document.getElementById(_0xd5('cWwtbm90aWYtY2xvc2U='));
if(!_0x253af5||!_0x253bf5)return;
_0x253af5.addEventListener(_0xd5('Y2xpY2s='),(_0x251cf5)=>{
_0x251cf5.stopPropagation();
const _0x251df5=_0x253bf5.style.display!==_0xd5('bm9uZQ==');
_0x253bf5.style.display=_0x251df5?_0xd5('bm9uZQ=='):_0xd5('YmxvY2s=');
if(!_0x251df5)loadNotifications();
});
if(_0x253cf5){
_0x253cf5.addEventListener(_0xd5('Y2xpY2s='),(_0x2533f5)=>{
_0x2533f5.stopPropagation();
_0x253bf5.style.display=_0xd5('bm9uZQ==');
});
}
checkUnreadNotifications();
}
async function loadNotifications(){
const _0x2589f5=document.getElementById(_0xd5('cWwtbm90aWYtbGlzdA=='));
if(!_0x2589f5)return;
_0x2589f5.innerHTML=_0xd5('PHAgY2xhc3M9InFsLW5vdGlmLWVtcHR5Ij5OZW5odW1hIG5vdGlmaWNhw6fDo28uPC9wPg==');
const _0x258af5=document.querySelector(_0xd5('LnFsLW5vdGlmLWJhZGdl'));
if(_0x258af5)_0x258af5.style.display=_0xd5('bm9uZQ==');
}
async function checkUnreadNotifications(){
const _0x259ff5=document.querySelector(_0xd5('LnFsLW5vdGlmLWJhZGdl'));
if(_0x259ff5)_0x259ff5.style.display=_0xd5('bm9uZQ==');
}
function setupSuggestionChips(){
const _0x25b3f5=document.getElementById(_0xd5('cWwtY2hpcHM='));
if(!_0x25b3f5)return;
PROMPT_TEMPLATES.forEach((_0x262cf5)=>{
const _0x262df5=document.createElement(_0xd5('YnV0dG9u'));
_0x262df5.className=_0xd5('cWwtY2hpcA==');
_0x262df5.innerHTML=_0x262cf5.icon+" "+_0x262cf5.label;
_0x262df5.title=_0x262cf5.prompt;
_0x262df5.addEventListener(_0xd5('Y2xpY2s='),()=>{
const _0x2621f5=document.getElementById(_0xd5('cWwtbXNn'));
if(_0x2621f5)_0x2621f5.value=_0x262cf5.prompt;
});
_0x25b3f5.appendChild(_0x262df5);
});
}
const WATERMARK_PROMPT=_0xd5('UmVtb3ZhIGEgbWFyY2EgZCfDoWd1YSBkbyBMb3ZhYmxlLiBQYXJhIGlzc28sIGFkaWNpb25lIG5vIGluw61jaW8gZG8gYXJxdWl2byBDU1MgcHJpbmNpcGFsIGRvIHByb2pldG8gKHNyYy9pbmRleC5jc3MsIHNyYy9zdHlsZXMuY3NzLCBzcmMvQXBwLmNzcyBvdSBvIGFycXVpdm8gQ1NTIGdsb2JhbCBleGlzdGVudGUpIGV4YXRhbWVudGUgZXN0YSByZWdyYSBDU1MsIHNlbSBhbHRlcmFyIG1haXMgbmFkYToKCiNsb3ZhYmxlLWJhZGdlIHsKICBkaXNwbGF5OiBub25lICFpbXBvcnRhbnQ7Cn0KCk7Do28gbW9kaWZpcXVlIG5lbmh1bSBvdXRybyBhcnF1aXZvLCBsYXlvdXQsIHRleHRvIG91IGNvbXBvbmVudGUuIEFwZW5hcyBpbnNpcmEgZXNzYSByZWdyYSBubyBDU1MgZ2xvYmFsLg==');
const WM_CSS_PATHS=[_0xd5('c3JjL3N0eWxlcy5jc3M='),_0xd5('c3JjL2luZGV4LmNzcw=='),_0xd5('c3JjL0FwcC5jc3M='),_0xd5('c3JjL2dsb2JhbC5jc3M='),_0xd5('YXBwL2dsb2JhbHMuY3Nz'),_0xd5('c3R5bGVzL2dsb2JhbHMuY3Nz')];
function wmEnsureBadgeHidden(_0x267ef5){
var _0x267ff5=String(_0x267ef5||"");
if(/#lovable-badge[^{}]*\{[^}]*display\s*:\s*none/i.test(_0x267ff5))return{changed:false,css:_0x267ff5};
return{changed:true,css:_0x267ff5.replace(/\s+$/,"")+_0xd5('CgojbG92YWJsZS1iYWRnZSB7CiAgZGlzcGxheTogbm9uZSAhaW1wb3J0YW50Owp9Cg==')};
}
function wmGetGlobalCss(_0x268ef5,_0x268ff5){
return new Promise(function(_0x26b8f5,_0x26b9f5){
chrome.runtime.sendMessage({action:_0xd5('ZG93bmxvYWRQcm9qZWN0'),projectId:_0x268ef5,token:_0x268ff5},function(_0x2d3af5){
if(chrome.runtime.lastError)return _0x26b9f5(new Error(chrome.runtime.lastError.message));
if(!_0x2d3af5||!_0x2d3af5.success)return _0x26b9f5(new Error((_0x2d3af5&&_0x2d3af5.error)||_0xd5('RmFsaGEgYW8gY2FycmVnYXIgYXJxdWl2b3MgZG8gcHJvamV0by4=')));
var _0x2d3bf5=_0x2d3af5.files||[],_0x2d3cf5=null;
var _0x2d3df5=function(_0x2930f5){return String((_0x2930f5&&(_0x2930f5.path||_0x2930f5.name||_0x2930f5.file_path))||"").replace(/^\//,"");};
var _0x2d3ef5=function(_0x296af5){return _0x296af5.content!=null?_0x296af5.content:(_0x296af5.contents!=null?_0x296af5.contents:_0x296af5.text);};
for(var _0x2d3ff5=0;_0x2d3ff5<_0x2d3bf5.length&&!_0x2d3cf5;_0x2d3ff5++){
var _0x2d40f5=_0x2d3df5(_0x2d3bf5[_0x2d3ff5]);
if(WM_CSS_PATHS.indexOf(_0x2d40f5)!==-1)_0x2d3cf5={file:_0x2d3bf5[_0x2d3ff5],path:_0x2d40f5};
}
if(!_0x2d3cf5){
var _0x2d41f5=_0x2d3bf5.filter(function(_0x2a5ff5){var _0x2a60f5=_0x2d3df5(_0x2a5ff5);return/\.css$/i.test(_0x2a60f5)&&_0x2a60f5.indexOf(_0xd5('bm9kZV9tb2R1bGVz'))===-1;});
var _0x2d42f5=_0x2d41f5.find(function(_0x2a99f5){var _0x2a9af5=_0x2d3ef5(_0x2a99f5);return typeof _0x2a9af5===_0xd5('c3RyaW5n')&&(/@tailwind|@import\s+["']tailwindcss/i.test(_0x2a9af5)||_0x2a9af5.indexOf(_0xd5('OnJvb3Q='))!==-1);});
if(_0x2d42f5)_0x2d3cf5={file:_0x2d42f5,path:_0x2d3df5(_0x2d42f5)};
}
if(!_0x2d3cf5)return _0x26b9f5(new Error(_0xd5('Q1NTIGdsb2JhbCBkbyBwcm9qZXRvIG7Do28gZW5jb250cmFkby4=')));
var _0x2d43f5=_0x2d3cf5.file;
var _0x2d44f5=_0x2d43f5.content!=null?_0x2d43f5.content:(_0x2d43f5.contents!=null?_0x2d43f5.contents:_0x2d43f5.text);
if(typeof _0x2d44f5!==_0xd5('c3RyaW5n'))return _0x26b9f5(new Error(_0xd5('Q29udGXDumRvIGRvIENTUyBnbG9iYWwgaW5kaXNwb27DrXZlbC4=')));
_0x26b8f5({path:_0x2d3cf5.path,css:_0x2d44f5});
});
});
}
function setupWatermarkButton(){
var _0x2d59f5=document.getElementById(_0xd5('cWwtcmVtb3ZlLXdhdGVybWFyaw=='));
if(!_0x2d59f5)return;
_0x2d59f5.addEventListener(_0xd5('Y2xpY2s='),async function(){
var _0x2fe9f5=document.getElementById(_0xd5('cWwtbG9n'));
_0x2d59f5.disabled=true;
_0x2d59f5.textContent=_0xd5('4o+zIFJlbW92ZW5kby4uLg==');
await requestLatestTokenFromHook();
var _0x2feaf5=await new Promise(function(_0x2e89f5){
chrome.storage.local.get([_0xd5('bG92YWJsZV9wcm9qZWN0SWQ='),_0xd5('bG92YWJsZV90b2tlbg==')],_0x2e89f5);
});
var _0x2febf5=_0x2feaf5.lovable_projectId||"";
var _0x2fecf5=_0x2feaf5.lovable_token||"";
if(!_0x2febf5||!_0x2fecf5){
if(_0x2fe9f5){_0x2fe9f5.className=_0xd5('cWwtbG9nLWVycm9y');_0x2fe9f5.innerText=_0xd5('4pqgIFByb2pldG8gbsOjbyBzaW5jcm9uaXphZG8u');}
_0x2d59f5.disabled=false;
_0x2d59f5.textContent=_0xd5('8J+aqyBSZW1vdmVyIE1hcmNhIGRlIMOBZ3Vh');
return;
}
var _0x2fedf5=_0x2fecf5.indexOf(_0xd5('QmVhcmVyIA=='))===0?_0x2fecf5.slice(7):_0x2fecf5;
try{
var _0x2feef5=await wmGetGlobalCss(_0x2febf5,_0x2fedf5);
var _0x2feff5=wmEnsureBadgeHidden(_0x2feef5.css);
if(!_0x2feff5.changed){
if(_0x2fe9f5){_0x2fe9f5.className=_0xd5('cWwtbG9nLXN1Y2Nlc3M=');_0x2fe9f5.innerText=_0xd5('4pyTIE1hcmNhIGQnw6FndWEgasOhIGVzdGF2YSByZW1vdmlkYS4=');}
}else{
var _0x2ff0f5=await lovableApiFetch(_0xd5('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXYvcHJvamVjdHMv')+encodeURIComponent(_0x2febf5)+_0xd5('L2VkaXQtY29kZQ=='),{
method:_0xd5('UE9TVA=='),
headers:{"Content-Type":_0xd5('YXBwbGljYXRpb24vanNvbg=='),"Authorization":_0xd5('QmVhcmVyIA==')+_0x2fedf5},
body:JSON.stringify({
changes:[{path:_0x2feef5.path,content:_0x2feff5.css}],
commit_message:_0xd5('UmVtb3ZlIExvdmFibGUgd2F0ZXJtYXJrIGJhZGdl'),
file_edit_type:_0xd5('Q29kZUVkaXQ='),
uploads:[]
})
});
if(!_0x2ff0f5||!(_0x2ff0f5.ok===true||(typeof _0x2ff0f5.status===_0xd5('bnVtYmVy')&&_0x2ff0f5.status>=200&&_0x2ff0f5.status<300))){
var _0x2ff1f5="";
try{_0x2ff1f5=typeof _0x2ff0f5.data===_0xd5('c3RyaW5n')?_0x2ff0f5.data:JSON.stringify(_0x2ff0f5.data);}catch(_0x2ff3f5){}
throw new Error(_0xd5('ZWRpdC1jb2RlIGZhbGhvdTog')+(_0x2ff0f5&&_0x2ff0f5.status)+" "+_0x2ff1f5);
}
if(_0x2fe9f5){_0x2fe9f5.className=_0xd5('cWwtbG9nLXN1Y2Nlc3M=');_0x2fe9f5.innerText=_0xd5('4pyTIE1hcmNhIGQnw6FndWEgcmVtb3ZpZGEhIEF0dWFsaXplIGEgcHJldmlldy4=');}
}
}catch(_0x2ff5f5){
if(_0x2fe9f5){_0x2fe9f5.className=_0xd5('cWwtbG9nLWVycm9y');_0x2fe9f5.innerText="\u2717 "+(_0x2ff5f5.message||_0x2ff5f5);}
}finally{
_0x2d59f5.disabled=false;
_0x2d59f5.textContent=_0xd5('8J+aqyBSZW1vdmVyIE1hcmNhIGRlIMOBZ3Vh');
}
});
}
function showPublishedUrlModal(_0x3158f5){
var _0x3159f5=document.getElementById(_0xd5('cWwtcHVibGlzaC1tb2RhbA=='));
if(_0x3159f5)_0x3159f5.remove();
var _0x315af5=document.createElement("div");
_0x315af5.id=_0xd5('cWwtcHVibGlzaC1tb2RhbA==');
_0x315af5.style.cssText=_0xd5('cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsMC43KTt6LWluZGV4OjIxNDc0ODM2NDc7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2JhY2tkcm9wLWZpbHRlcjpibHVyKDhweCk7Zm9udC1mYW1pbHk6SW50ZXIsc2Fucy1zZXJpZg==');
_0x315af5.innerHTML=
_0xd5('PGRpdiBzdHlsZT0iYmFja2dyb3VuZDojMTExMTEzO2JvcmRlcjoxcHggc29saWQgcmdiYSgyNDUsMTU4LDExLDAuMzUpO2JvcmRlci1yYWRpdXM6MTZweDtwYWRkaW5nOjI0cHg7bWF4LXdpZHRoOjQyMHB4O3dpZHRoOjkwJTtib3gtc2hhZG93OjAgMjRweCA4MHB4IC0xMnB4IHJnYmEoMCwwLDAsMC44KSI+')+
_0xd5('PGRpdiBzdHlsZT0iZm9udC1zaXplOjMycHg7dGV4dC1hbGlnbjpjZW50ZXI7bWFyZ2luLWJvdHRvbTo4cHgiPvCfjok8L2Rpdj4=')+
_0xd5('PGgzIHN0eWxlPSJtYXJnaW46MCAwIDhweDtjb2xvcjojZmJiZjI0O2ZvbnQtc2l6ZToxOHB4O2ZvbnQtd2VpZ2h0OjcwMDt0ZXh0LWFsaWduOmNlbnRlciI+UHJvamV0byBQdWJsaWNhZG8hPC9oMz4=')+
_0xd5('PHAgc3R5bGU9Im1hcmdpbjowIDAgMTZweDtjb2xvcjojYTFhMWFhO2ZvbnQtc2l6ZToxM3B4O3RleHQtYWxpZ246Y2VudGVyIj5TZXUgcHJvamV0byBlc3TDoSBhbyB2aXZvLiBBY2Vzc2UgcGVsbyBsaW5rIGFiYWl4bzo8L3A+')+
_0xd5('PGRpdiBzdHlsZT0iYmFja2dyb3VuZDojMGEwYTBiO2JvcmRlcjoxcHggc29saWQgcmdiYSgyNTUsMjU1LDI1NSwwLjA4KTtib3JkZXItcmFkaXVzOjEwcHg7cGFkZGluZzoxMHB4O21hcmdpbi1ib3R0b206MTZweDt3b3JkLWJyZWFrOmJyZWFrLWFsbCI+PGEgaHJlZj0i')+_0x3158f5+_0xd5('IiB0YXJnZXQ9Il9ibGFuayIgc3R5bGU9ImNvbG9yOiM2MGE1ZmE7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Zm9udC1zaXplOjEzcHgiPg==')+_0x3158f5+_0xd5('PC9hPjwvZGl2Pg==')+
_0xd5('PGRpdiBzdHlsZT0iZGlzcGxheTpmbGV4O2dhcDo4cHgiPg==')+
_0xd5('PGJ1dHRvbiBpZD0icWwtcHVibGlzaC1jb3B5IiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6MTBweDtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMjU1LDI1NSwyNTUsMC4xMik7YmFja2dyb3VuZDp0cmFuc3BhcmVudDtjb2xvcjojZjRmNGY1O2JvcmRlci1yYWRpdXM6MTBweDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MTNweDtmb250LXdlaWdodDo2MDAiPvCfk4sgQ29waWFyPC9idXR0b24+')+
_0xd5('PGJ1dHRvbiBpZD0icWwtcHVibGlzaC1vcGVuIiBzdHlsZT0iZmxleDoxO3BhZGRpbmc6MTBweDtib3JkZXI6bm9uZTtiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxMzVkZWcsI2Y1OWUwYiwjZDk3NzA2KTtjb2xvcjojZmZmO2JvcmRlci1yYWRpdXM6MTBweDtjdXJzb3I6cG9pbnRlcjtmb250LXNpemU6MTNweDtmb250LXdlaWdodDo3MDAiPvCflJcgQWJyaXI8L2J1dHRvbj4=')+
_0xd5('PC9kaXY+')+
_0xd5('PGJ1dHRvbiBpZD0icWwtcHVibGlzaC1jbG9zZSIgc3R5bGU9IndpZHRoOjEwMCU7bWFyZ2luLXRvcDo4cHg7cGFkZGluZzo4cHg7Ym9yZGVyOm5vbmU7YmFja2dyb3VuZDp0cmFuc3BhcmVudDtjb2xvcjojNzE3MTdhO2N1cnNvcjpwb2ludGVyO2ZvbnQtc2l6ZToxMnB4Ij5GZWNoYXI8L2J1dHRvbj4=')+
_0xd5('PC9kaXY+');
document.body.appendChild(_0x315af5);
document.getElementById(_0xd5('cWwtcHVibGlzaC1jb3B5')).addEventListener(_0xd5('Y2xpY2s='),function(){
navigator.clipboard.writeText(_0x3158f5);
this.textContent=_0xd5('4pyTIENvcGlhZG8h');
});
document.getElementById(_0xd5('cWwtcHVibGlzaC1vcGVu')).addEventListener(_0xd5('Y2xpY2s='),function(){window.open(_0x3158f5,_0xd5('X2JsYW5r'));});
document.getElementById(_0xd5('cWwtcHVibGlzaC1jbG9zZQ==')).addEventListener(_0xd5('Y2xpY2s='),function(){_0x315af5.remove();});
_0x315af5.addEventListener(_0xd5('Y2xpY2s='),function(_0x3168f5){if(_0x3168f5.target===_0x315af5)_0x315af5.remove();});
}
function setupPublishProject(){
var _0x317df5=document.getElementById(_0xd5('cWwtcHVibGlzaC1wcm9qZWN0'));
if(!_0x317df5)return;
_0x317df5.addEventListener(_0xd5('Y2xpY2s='),async function(){
var _0x31d2f5=document.getElementById(_0xd5('cWwtbG9n'));
var _0x31d3f5=_0x317df5.textContent;
_0x317df5.disabled=true;
_0x317df5.textContent=_0xd5('QWJyaW5kbyBQdWJsaWNhci4uLg==');
try{
var _0x31d4f5=await new Promise(function(_0x31e2f5){
chrome.runtime.sendMessage({action:_0xd5('b3Blbk5hdGl2ZUxvdmFibGVQdWJsaXNo')},function(_0x31f1f5){_0x31e2f5(_0x31f1f5||{ok:false,error:_0xd5('U2VtIHJlc3Bvc3Rh')});});
});
if(!_0x31d4f5.ok)throw new Error(_0x31d4f5.error||_0xd5('TsOjbyBmb2kgcG9zc8OtdmVsIGFicmlyIG8gUHVibGljYXIgZG8gTG92YWJsZS4='));
if(_0x31d2f5){_0x31d2f5.className=_0xd5('cWwtbG9nLXN1Y2Nlc3M=');_0x31d2f5.innerText=_0xd5('4pyTIFB1YmxpY2HDp8OjbyBhYmVydGEgbm8gTG92YWJsZS4=');}
}catch(_0x31f3f5){
if(_0x31d2f5){_0x31d2f5.className=_0xd5('cWwtbG9nLWVycm9y');_0x31d2f5.innerText="✗ "+(_0x31f3f5.message||_0x31f3f5);}
}finally{
_0x317df5.disabled=false;
_0x317df5.textContent=_0x31d3f5||_0xd5('8J+MkCBQdWJsaWNhciBQcm9qZXRv');
}
});
}
function updateTrialCountdown(){
const _0x39eaf5=document.getElementById(_0xd5('cWwtdHJpYWwtY291bnRkb3du'));
if(!_0x39eaf5)return;
if(window.qlCountdownInterval){
clearInterval(window.qlCountdownInterval);
window.qlCountdownInterval=null;
}
if(isLifetimeLicense()){
_0x39eaf5.style.display=_0xd5('YmxvY2s=');
_0x39eaf5.innerHTML=
_0xd5('PGRpdiBjbGFzcz0icWwtbGlmZXRpbWUtY2FyZCI+')+
_0xd5('PHNwYW4gY2xhc3M9InFsLWxpZmV0aW1lLWljb24iPuKInjwvc3Bhbj4=')+
_0xd5('PHNwYW4gY2xhc3M9InFsLWxpZmV0aW1lLWxhYmVsIj5WSVRBTMONQ0lPPC9zcGFuPg==')+
_0xd5('PHNwYW4gY2xhc3M9InFsLWxpZmV0aW1lLXN0YXR1cyI+QWNlc3NvIHZpdGFsw61jaW8gYXRpdmFkbzwvc3Bhbj4=')+
_0xd5('PC9kaXY+');
return;
}
if(!qlExpiresAt){
_0x39eaf5.style.display=_0xd5('YmxvY2s=');
_0x39eaf5.innerHTML=
_0xd5('PGRpdiBjbGFzcz0icWwtbGlmZXRpbWUtY2FyZCI+')+
_0xd5('PHNwYW4gY2xhc3M9InFsLWxpZmV0aW1lLWljb24iPuKInjwvc3Bhbj4=')+
_0xd5('PHNwYW4gY2xhc3M9InFsLWxpZmV0aW1lLWxhYmVsIj5WSVRBTMONQ0lPPC9zcGFuPg==')+
_0xd5('PHNwYW4gY2xhc3M9InFsLWxpZmV0aW1lLXN0YXR1cyI+QWNlc3NvIHNlbSBleHBpcmHDp8Ojbzwvc3Bhbj4=')+
_0xd5('PC9kaXY+');
return;
}
_0x39eaf5.style.display=_0xd5('YmxvY2s=');
const _0x39ebf5=Date.now();
const _0x39ecf5=new Date(qlExpiresAt).getTime();
const _0x39edf5=Math.max(_0x39ecf5-_0x39ebf5,3600000);
function _0x39eef5(){
const _0x39aaf5=_0x39ecf5-Date.now();
if(_0x39aaf5<=0){
_0x39eaf5.innerHTML=_0xd5('PHNwYW4gY2xhc3M9InFsLWNvdW50ZG93bi1leHBpcmVkIj48c3BhbiBzdHlsZT0idmVydGljYWwtYWxpZ246bWlkZGxlO2Rpc3BsYXk6aW5saW5lLWZsZXgiPg==')+SVG_ICONS.clock+_0xd5('PC9zcGFuPiBMaWNlbsOnYSBleHBpcmFkYTwvc3Bhbj48ZGl2IGNsYXNzPSJxbC10cmlhbC1iYXIiPjxkaXYgY2xhc3M9InFsLXRyaWFsLWJhci1maWxsIHFsLWJhci1leHBpcmVkIiBzdHlsZT0id2lkdGg6MCUiPjwvZGl2PjwvZGl2Pg==');
handleLicenseExpired();
return;
}
const _0x39abf5=Math.floor(_0x39aaf5/86400000);
const _0x39acf5=Math.floor((_0x39aaf5%86400000)/3600000);
const _0x39adf5=Math.floor((_0x39aaf5%3600000)/60000);
const _0x39aef5=Math.floor((_0x39aaf5%60000)/1000);
const _0x39aff5=Math.max(0,Math.min(100,(_0x39aaf5/_0x39edf5)*100));
let _0x39b0f5='';
if(_0x39abf5>0)_0x39b0f5=_0x39abf5+'d '+_0x39acf5+'h '+_0x39adf5+'m';
else if(_0x39acf5>0)_0x39b0f5=_0x39acf5+'h '+_0x39adf5+'m '+String(_0x39aef5).padStart(2,'0')+'s';
else _0x39b0f5=_0x39adf5+':'+String(_0x39aef5).padStart(2,'0');
const _0x39b1f5=_0x39aff5<20?_0xd5('IHFsLWJhci11cmdlbnQ='):'';
const _0x39b2f5=isTrialLicense()?_0xd5('VGVzdGUgZXhwaXJhIGVt'):_0xd5('UGxhbm8gZXhwaXJhIGVt');
_0x39eaf5.innerHTML=_0xd5('PGRpdiBjbGFzcz0icWwtY291bnRkb3duLXJvdyI+PHNwYW4gY2xhc3M9InFsLWNvdW50ZG93bi1pY29uIj4=')+SVG_ICONS.clock+_0xd5('PC9zcGFuPjxzcGFuIGNsYXNzPSJxbC1jb3VudGRvd24tbGFiZWwiPg==')+_0x39b2f5+_0xd5('PC9zcGFuPjxzcGFuIGNsYXNzPSJxbC1jb3VudGRvd24tdGltZSI+')+_0x39b0f5+_0xd5('PC9zcGFuPjwvZGl2PjxkaXYgY2xhc3M9InFsLXRyaWFsLWJhciI+PGRpdiBjbGFzcz0icWwtdHJpYWwtYmFyLWZpbGw=')+_0x39b1f5+_0xd5('IiBzdHlsZT0id2lkdGg6')+_0x39aff5+_0xd5('JSI+PC9kaXY+PC9kaXY+');
}
_0x39eef5();
window.qlCountdownInterval=setInterval(_0x39eef5,1000);
}
function setupMinimize(){
const _0x3a03f5=document.getElementById(_0xd5('cWwtbWluaW1pemU='));
if(!_0x3a03f5)return;
_0x3a03f5.addEventListener(_0xd5('Y2xpY2s='),(_0x3a72f5)=>{
_0x3a72f5.stopPropagation();
const _0x3a73f5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='));
if(!_0x3a73f5)return;
qlMinimized=!qlMinimized;
_0x3a73f5.classList.toggle(_0xd5('cWwtbWluaW1pemVk'),qlMinimized);
_0x3a03f5.textContent=qlMinimized?"□":"−";
chrome.storage.local.set({ql_minimized:qlMinimized});
});
}
function setupDarkMode(){
const _0x3a88f5=document.querySelector(_0xd5('LnFsLWljb24tYnRuW3RpdGxlPSJUZW1hIl0='));
if(!_0x3a88f5)return;
_0x3a88f5.addEventListener(_0xd5('Y2xpY2s='),(_0x3b0af5)=>{
_0x3b0af5.stopPropagation();
const _0x3b0bf5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='));
if(!_0x3b0bf5)return;
const _0x3b0cf5=_0x3b0bf5.classList.toggle(_0xd5('cWwtbGlnaHQ='));
chrome.storage.local.set({ql_dark_mode:!_0x3b0cf5});
});
}
function setupModoPlano(){}
function setupShield(){
const _0x3b25f5=document.getElementById(_0xd5('cWwtc2hpZWxkLWJ0bg=='));
if(_0x3b25f5)_0x3b25f5.remove();
qlShieldActive=false;
cleanupLovablePromptLocks();
}
function injectShieldOverlay(){
cleanupLovablePromptLocks();
}
function removeShieldOverlay(){
const _0x3ba4f5=document.getElementById(_0xd5('cWwtc2hpZWxkLW92ZXJsYXk='));
if(_0x3ba4f5)_0x3ba4f5.remove();
const _0x3ba5f5=document.querySelector(_0xd5('Zm9ybSNjaGF0LWlucHV0'));
if(!_0x3ba5f5)return;
const _0x3ba6f5=_0x3ba5f5.querySelectorAll(_0xd5('W2RhdGEtcWwtc2hpZWxkLWRpc2FibGVkXQ=='));
_0x3ba6f5.forEach(_0x3c94f5=>{
const _0x3c95f5=_0x3c94f5.dataset.qlShieldDisabled;
if(_0x3c95f5===_0xd5('dHJ1ZQ=='))_0x3c94f5.disabled=true;
else if(_0x3c95f5===''||_0x3c95f5===_0xd5('ZmFsc2U='))_0x3c94f5.disabled=false;
delete _0x3c94f5.dataset.qlShieldDisabled;
const _0x3c96f5=_0x3c94f5.dataset.qlShieldTabindex;
if(_0x3c96f5)_0x3c94f5.setAttribute(_0xd5('dGFiaW5kZXg='),_0x3c96f5);
else _0x3c94f5.removeAttribute(_0xd5('dGFiaW5kZXg='));
delete _0x3c94f5.dataset.qlShieldTabindex;
if(_0x3c94f5.dataset.qlShieldEditable===_0xd5('dHJ1ZQ==')){
_0x3c94f5.contentEditable=_0xd5('dHJ1ZQ==');
delete _0x3c94f5.dataset.qlShieldEditable;
}
});
}
function startHeartbeat(){return;}
function handleLicenseExpired(){
if(qlExpiredHandled)return;
qlExpiredHandled=true;
if(qlHeartbeatInterval)clearInterval(qlHeartbeatInterval);
if(window.qlCountdownInterval)clearInterval(window.qlCountdownInterval);
const _0x3debf5=document.createElement("div");
_0x3debf5.className=_0xd5('cWwtc3dlZXRhbGVydC1vdmVybGF5');
_0x3debf5.innerHTML=templateExpiredOverlay();
const _0x3decf5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='));
if(_0x3decf5)_0x3decf5.appendChild(_0x3debf5);
requestAnimationFrame(()=>_0x3debf5.classList.add(_0xd5('cWwtc3dlZXRhbGVydC12aXNpYmxl')));
const _0x3dedf5=_0x3debf5.querySelector(_0xd5('I3FsLXN3ZWV0YWxlcnQtcmVuZXc='));
if(_0x3dedf5){
_0x3dedf5.addEventListener(_0xd5('Y2xpY2s='),()=>{
_0x3debf5.remove();
if(_0x3decf5)showPaymentUI(_0x3decf5);
});
}
const _0x3deef5=_0x3debf5.querySelector(_0xd5('I3FsLXN3ZWV0YWxlcnQtY2xvc2U='));
if(_0x3deef5){
_0x3deef5.addEventListener(_0xd5('Y2xpY2s='),()=>{
_0x3debf5.classList.remove(_0xd5('cWwtc3dlZXRhbGVydC12aXNpYmxl'));
setTimeout(()=>{
_0x3debf5.remove();
chrome.storage.local.remove([_0xd5('cWxfbGljZW5zZV92YWxpZA=='),_0xd5('cWxfbGljZW5zZV9rZXk='),_0xd5('cWxfc2Vzc2lvbl9pZA=='),_0xd5('cWxfdXNlcl9uYW1l'),_0xd5('cWxfZXhwaXJlc19hdA=='),_0xd5('cWxfbGljZW5zZV9zdGF0dXM=')],()=>{
if(_0x3decf5)showMainUI(document.getElementById(_0xd5('cWwtZmxvYXRpbmc=')));
});
},300);
});
}
}
async function showPaymentUI(_0x3e68f5,_0x3e69f5){
if(_0x3e69f5){
showCheckoutScreen(_0x3e68f5,_0x3e69f5);
return;
}
_0x3e68f5.innerHTML=templatePaymentUI(qlMinimized);
setupMinimize();
setupDrag();
setupResize();
const _0x3e6af5=document.getElementById(_0xd5('cWwtcGF5LWJhY2s='));
if(_0x3e6af5){
_0x3e6af5.addEventListener(_0xd5('Y2xpY2s='),()=>{
chrome.storage.local.get([_0xd5('cWxfbGljZW5zZV92YWxpZA==')],(_0x3e67f5)=>{
if(_0x3e67f5.ql_license_valid)showMainUI(_0x3e68f5);
else showMainUI(document.getElementById(_0xd5('cWwtZmxvYXRpbmc=')));
});
});
}
try{
const _0x3f00f5=await bgFetch(PACKAGES_URL,{
method:"GET",
headers:{"apikey":SUPABASE_ANON_KEY,"Authorization":_0xd5('QmVhcmVyIA==')+SUPABASE_ANON_KEY}
});
const _0x3f01f5=document.getElementById(_0xd5('cWwtcGFja2FnZXMtbGlzdA=='));
if(!_0x3f01f5)return;
if(!_0x3f00f5||!Array.isArray(_0x3f00f5)||_0x3f00f5.length===0){
_0x3f01f5.innerHTML=_0xd5('PGRpdiBjbGFzcz0icWwtcGF5LWxvYWRpbmciPk5lbmh1bSBwbGFubyBkaXNwb27DrXZlbC48L2Rpdj4=');
return;
}
_0x3f01f5.innerHTML=_0x3f00f5.map(_0x3eebf5=>templatePackageCard(_0x3eebf5)).join('');
_0x3f01f5.querySelectorAll(_0xd5('LnFsLXBrZy1jYXJk')).forEach(_0x3f0ef5=>{
_0x3f0ef5.querySelector(_0xd5('LnFsLXBrZy1zZWxlY3QtYnRu')).addEventListener(_0xd5('Y2xpY2s='),()=>{
const _0x3f2ef5={
id:_0x3f0ef5.getAttribute(_0xd5('ZGF0YS1wa2ctaWQ=')),
name:_0x3f0ef5.getAttribute(_0xd5('ZGF0YS1wa2ctbmFtZQ==')),
price:_0x3f0ef5.getAttribute(_0xd5('ZGF0YS1wa2ctcHJpY2U='))
};
showCheckoutScreen(_0x3e68f5,_0x3f2ef5);
});
});
}catch(_0x3f30f5){
console.error(_0xd5('W1FMXSBQYWNrYWdlIGxvYWQgZXJyb3I6'),_0x3f30f5);
const _0x3f48f5=document.getElementById(_0xd5('cWwtcGFja2FnZXMtbGlzdA=='));
if(_0x3f48f5)_0x3f48f5.innerHTML=_0xd5('PGRpdiBjbGFzcz0icWwtcGF5LWxvYWRpbmciPkVycm8gYW8gY2FycmVnYXIgcGxhbm9zLiBUZW50ZSBub3ZhbWVudGUuPC9kaXY+');
}
}
function showCheckoutScreen(_0x409ef5,_0x409ff5){
_0x409ef5.innerHTML=templateCheckoutScreen(_0x409ff5,qlMinimized);
setupMinimize();
setupDrag();
setupResize();
let _0x40a0f5=_0xd5('bXBlc2E=');
const _0x40a1f5=document.getElementById(_0xd5('cWwtY2hlY2tvdXQtYmFjaw=='));
if(_0x40a1f5){
_0x40a1f5.addEventListener(_0xd5('Y2xpY2s='),()=>showPaymentUI(_0x409ef5));
}
document.querySelectorAll(_0xd5('LnFsLW1ldGhvZC1idG4=')).forEach(_0x4037f5=>{
_0x4037f5.addEventListener(_0xd5('Y2xpY2s='),()=>{
document.querySelectorAll(_0xd5('LnFsLW1ldGhvZC1idG4=')).forEach(_0x404bf5=>_0x404bf5.classList.remove(_0xd5('cWwtbWV0aG9kLWFjdGl2ZQ==')));
_0x4037f5.classList.add(_0xd5('cWwtbWV0aG9kLWFjdGl2ZQ=='));
_0x40a0f5=_0x4037f5.getAttribute(_0xd5('ZGF0YS1tZXRob2Q='));
const _0x4070f5=document.getElementById(_0xd5('cWwtcGhvbmUtaGludA=='));
if(_0x4070f5)_0x4070f5.textContent=_0x40a0f5===_0xd5('bXBlc2E=')?_0xd5('TS1QZXNhOiA4NCBvdSA4NQ=='):_0xd5('ZS1Nb2xhOiA4NiBvdSA4Nw==');
});
});
const _0x40a2f5=document.getElementById(_0xd5('cWwtY29uZmlybS1wYXk='));
if(_0x40a2f5){
_0x40a2f5.addEventListener(_0xd5('Y2xpY2s='),async()=>{
const _0x41baf5=(document.getElementById(_0xd5('cWwtcGF5LXBob25l'))||{}).value?(document.getElementById(_0xd5('cWwtcGF5LXBob25l'))||{}).value.replace(/\D/g,""):"";
const _0x41bbf5=document.getElementById(_0xd5('cWwtcGF5LWxvZw=='));
if(_0x41baf5.length!==9){
if(_0x41bbf5){_0x41bbf5.className=_0xd5('cWwtcGF5LWxvZyBxbC1wYXktZXJyb3I=');_0x41bbf5.textContent=_0xd5('TsO6bWVybyBkZXZlIHRlciA5IGTDrWdpdG9zLg==');}
return;
}
const _0x41bcf5=_0x41baf5.substring(0,2);
if(_0x40a0f5===_0xd5('bXBlc2E=')&&!["84","85"].includes(_0x41bcf5)){
if(_0x41bbf5){_0x41bbf5.className=_0xd5('cWwtcGF5LWxvZyBxbC1wYXktZXJyb3I=');_0x41bbf5.textContent=_0xd5('TS1QZXNhOiB1c2UgODQgb3UgODUu');}
return;
}
if(_0x40a0f5===_0xd5('ZW1vbGE=')&&!["86","87"].includes(_0x41bcf5)){
if(_0x41bbf5){_0x41bbf5.className=_0xd5('cWwtcGF5LWxvZyBxbC1wYXktZXJyb3I=');_0x41bbf5.textContent=_0xd5('ZS1Nb2xhOiB1c2UgODYgb3UgODcu');}
return;
}
_0x40a2f5.disabled=true;
_0x40a2f5.textContent=_0xd5('UHJvY2Vzc2FuZG8uLi4=');
if(_0x41bbf5){_0x41bbf5.className=_0xd5('cWwtcGF5LWxvZyBxbC1wYXktaW5mbw==');_0x41bbf5.textContent=_0xd5('RW52aWFuZG8gc29saWNpdGHDp8OjbyBkZSBwYWdhbWVudG8uLi4=');}
try{
const _0x428df5=await new Promise(_0x41def5=>chrome.storage.local.get([_0xd5('cWxfbGljZW5zZV9rZXk=')],_0x41def5));
const _0x428ef5=_0x428df5.ql_license_key||"";
const _0x428ff5=await bgFetch(EXT_PAYMENT_URL,{
method:_0xd5('UE9TVA=='),
headers:{"Content-Type":_0xd5('YXBwbGljYXRpb24vanNvbg=='),"apikey":SUPABASE_ANON_KEY},
body:JSON.stringify({
packageId:_0x409ff5.id,
numero:_0x41baf5,
metodo:_0x40a0f5,
license_key:_0x428ef5||undefined
})
});
if(_0x428ff5&&_0x428ff5.status===_0xd5('c3VjZXNzbw==')){
const _0x429af5=document.getElementById(_0xd5('cWwtYm9keQ=='));
if(_0x429af5){
_0x429af5.innerHTML=templatePaymentSuccess(_0x428ff5.license_key);
const _0x4308f5=document.getElementById(_0xd5('cWwtY29weS1rZXk='));
if(_0x4308f5){
_0x4308f5.addEventListener(_0xd5('Y2xpY2s='),()=>{
navigator.clipboard.writeText(_0x428ff5.license_key).then(()=>{
_0x4308f5.textContent=_0xd5('Q29waWFkbyE=');
setTimeout(()=>{_0x4308f5.textContent=_0xd5('Q29waWFyIENoYXZl');},2000);
}).catch(()=>{
const _0x42f5f5=document.getElementById(_0xd5('cWwtbmV3LWtleQ=='));
if(_0x42f5f5){const _0x42eff5=document.createRange();_0x42eff5.selectNodeContents(_0x42f5f5);window.getSelection().removeAllRanges();window.getSelection().addRange(_0x42eff5);}
_0x4308f5.textContent=_0xd5('U2VsZWNjaW9uYWRvIOKAlCBDdHJsK0M=');
});
});
}
const _0x4309f5=document.getElementById(_0xd5('cWwtYWN0aXZhdGUta2V5'));
if(_0x4309f5){
_0x4309f5.addEventListener(_0xd5('Y2xpY2s='),()=>{
chrome.storage.local.set({
ql_license_valid:true,
ql_license_key:_0x428ff5.license_key,
ql_expires_at:_0x428ff5.expires_at||null,
ql_license_status:_0xd5('YWN0aXZl'),
ql_session_id:null
},()=>{
qlExpiresAt=_0x428ff5.expires_at||null;
qLicenseStatus=_0xd5('YWN0aXZl');
qlExpiredHandled=false;
showMainUI(_0x409ef5);
startHeartbeat(_0x428ff5.license_key);
});
});
}
}
}else{
const _0x432bf5=(_0x428ff5&&_0x428ff5.error)?_0x428ff5.error:_0xd5('UGFnYW1lbnRvIGZhbGhvdS4gVGVudGUgbm92YW1lbnRlLg==');
if(_0x41bbf5){_0x41bbf5.className=_0xd5('cWwtcGF5LWxvZyBxbC1wYXktZXJyb3I=');_0x41bbf5.textContent=""+_0x432bf5;}
_0x40a2f5.disabled=false;
_0x40a2f5.textContent=_0xd5('UGFnYXIg')+_0x409ff5.price+_0xd5('IE1aTg==');
}
}catch(_0x432df5){
if(_0x41bbf5){_0x41bbf5.className=_0xd5('cWwtcGF5LWxvZyBxbC1wYXktZXJyb3I=');_0x41bbf5.textContent=""+(_0x432df5.message||_0xd5('RXJybyBkZSBjb25leMOjby4='));}
_0x40a2f5.disabled=false;
_0x40a2f5.textContent=_0xd5('UGFnYXIg')+_0x409ff5.price+_0xd5('IE1aTg==');
}
});
}
}
function qlBootstrap(){
requestLatestTokenFromHook();
}
if(document.readyState===_0xd5('Y29tcGxldGU=')||document.readyState===_0xd5('aW50ZXJhY3RpdmU=')){
setTimeout(qlBootstrap,50);
}else{
document.addEventListener(_0xd5('RE9NQ29udGVudExvYWRlZA=='),function(){setTimeout(qlBootstrap,50);});
}
var qlRetryCount=0;
var qlRetryDelays=[300,600,1000,1500,2000,3000,4000,5000];
function qlRetryInit(){
if(document.getElementById(_0xd5('cWwtZmxvYXRpbmc='))||qlRetryCount>=qlRetryDelays.length)return;
var _0x434af5=qlRetryDelays[qlRetryCount];
qlRetryCount++;
setTimeout(function(){
if(!document.getElementById(_0xd5('cWwtZmxvYXRpbmc='))&&document.body){
createUI();
}
qlRetryInit();
},_0x434af5);
}
function updateSyncStatus(){
chrome.storage.local.get([_0xd5('bG92YWJsZV9wcm9qZWN0SWQ='),_0xd5('bG92YWJsZV90b2tlbg==')],(_0x4377f5)=>{
const _0x4378f5=document.getElementById(_0xd5('cWwtc3luYy1zdGF0dXM='));
if(!_0x4378f5)return;
if(_0x4377f5.lovable_projectId&&_0x4377f5.lovable_token){
_0x4378f5.className=_0xd5('cWwtc3luYy1zdGF0dXMgcWwtc3luYy1vaw==');
const _0x439af5=_0x4377f5.lovable_projectId.substring(0,6);
_0x4378f5.innerHTML=_0xd5('PHNwYW4gY2xhc3M9InFsLXN5bmMtdGV4dCI+PHNwYW4gc3R5bGU9InZlcnRpY2FsLWFsaWduOm1pZGRsZTtkaXNwbGF5OmlubGluZS1mbGV4Ij4=')+SVG_ICONS.checkSmall+_0xd5('PC9zcGFuPiBTaW5jcm9uaXphZG8hIFByb2pldG86IA==')+_0x439af5+_0xd5('Li4uPC9zcGFuPg==');
}else{
_0x4378f5.className=_0xd5('cWwtc3luYy1zdGF0dXMgcWwtc3luYy13YWl0aW5n');
_0x4378f5.innerHTML=_0xd5('PHNwYW4gY2xhc3M9InFsLXN5bmMtdGV4dCI+PHNwYW4gc3R5bGU9InZlcnRpY2FsLWFsaWduOm1pZGRsZTtkaXNwbGF5OmlubGluZS1mbGV4Ij4=')+SVG_ICONS.clock+_0xd5('PC9zcGFuPiBBZ3VhcmRhbmRvIHNpbmNyb25pemHDp8Ojby4uLjwvc3Bhbj4=');
}
});
}
function setupStorageWatch(){
chrome.storage.onChanged.addListener((_0x43a5f5)=>{
if(_0x43a5f5.lovable_projectId||_0x43a5f5.lovable_token){
updateSyncStatus();
}
});
}
function requestLatestTokenFromHook(_0x43aef5=1200){
return new Promise((_0x4480f5)=>{
let _0x4481f5=false;
function _0x4482f5(_0x43eef5){
if(_0x4481f5)return;
_0x4481f5=true;
clearTimeout(_0x4484f5);
chrome.storage.onChanged.removeListener(_0x4483f5);
_0x4480f5(_0x43eef5);
}
function _0x4483f5(_0x4415f5,_0x4416f5){
if(_0x4416f5!==_0xd5('bG9jYWw='))return;
if(_0x4415f5.lovable_token&&_0x4415f5.lovable_token.newValue){
_0x4482f5(true);
}
}
const _0x4484f5=setTimeout(()=>_0x4482f5(false),Math.max(300,_0x43aef5));
chrome.storage.onChanged.addListener(_0x4483f5);
try{
window.postMessage({type:_0xd5('bG92YWJsZVJlcXVlc3RUb2tlbg==')},"*");
setTimeout(()=>window.postMessage({type:_0xd5('bG92YWJsZVJlcXVlc3RUb2tlbg==')},"*"),120);
}catch(_0x4486f5){
_0x4482f5(false);
}
});
}
function loadChatHistory(_0x4495f5){
chrome.storage.local.get([QL_HISTORY_KEY],(_0x44a8f5)=>{
qlChatHistory=_0x44a8f5[QL_HISTORY_KEY]||[];
updateHistoryBadge();
if(_0x4495f5)_0x4495f5();
});
}
function saveChatHistory(){
if(qlChatHistory.length>QL_MAX_HISTORY)qlChatHistory=qlChatHistory.slice(-QL_MAX_HISTORY);
chrome.storage.local.set({[QL_HISTORY_KEY]:qlChatHistory});
}
function addToChatHistory(_0x44e7f5,_0x44e8f5){
qlChatHistory.push({text:_0x44e7f5,timestamp:new Date().toISOString(),status:_0x44e8f5||'ok'});
saveChatHistory();
updateHistoryBadge();
}
function updateHistoryBadge(){
const _0x44fdf5=document.getElementById(_0xd5('cWwtaGlzdG9yeS1iYWRnZQ=='));
if(!_0x44fdf5)return;
if(qlChatHistory.length>0){
_0x44fdf5.textContent=qlChatHistory.length;
_0x44fdf5.style.display=_0xd5('aW5saW5lLWZsZXg=');
}else{
_0x44fdf5.style.display=_0xd5('bm9uZQ==');
}
}
function formatChatDate(_0x4726f5){
var _0x4727f5=new Date(_0x4726f5);
var _0x4728f5=new Date();
var _0x4729f5=new Date(_0x4728f5.getFullYear(),_0x4728f5.getMonth(),_0x4728f5.getDate());
var _0x472af5=new Date(_0x4727f5.getFullYear(),_0x4727f5.getMonth(),_0x4727f5.getDate());
var _0x472bf5=(_0x4729f5-_0x472af5)/86400000;
if(_0x472bf5===0)return_0xd5('SG9qZQ==');
if(_0x472bf5===1)return_0xd5('T250ZW0=');
if(_0x472bf5<7)return[_0xd5('RG9taW5nbw=='),_0xd5('U2VndW5kYQ=='),_0xd5('VGVyw6dh'),_0xd5('UXVhcnRh'),_0xd5('UXVpbnRh'),_0xd5('U2V4dGE='),_0xd5('U8OhYmFkbw==')][_0x4727f5.getDay()];
return _0x4727f5.toLocaleDateString(_0xd5('cHQtQlI='));
}
function formatChatTime(_0x4772f5){
var _0x4773f5=new Date(_0x4772f5);
return String(_0x4773f5.getHours()).padStart(2,'0')+':'+String(_0x4773f5.getMinutes()).padStart(2,'0');
}
function renderHistoryView(){
const _0x4c05f5=document.getElementById(_0xd5('cWwtdGFiLWNvbnRlbnQ='));
if(!_0x4c05f5)return;
if(!qlChatHistory.length){
_0x4c05f5.innerHTML=_0xd5('PGRpdiBjbGFzcz0icWwtY2hhdC1lbXB0eSI+PGRpdiBzdHlsZT0ibWFyZ2luLWJvdHRvbTo4cHg7Y29sb3I6dmFyKC0tcWwtdGV4dC1tdXRlZCwjNzE3MTdhKSI+')+SVG_ICONS.msgBig+_0xd5('PC9kaXY+PGRpdiBzdHlsZT0iZm9udC1zaXplOjEzcHg7Zm9udC13ZWlnaHQ6NjAwO2NvbG9yOnZhcigtLXFsLXRleHQtcHJpbWFyeSwjZjRmNGY1KSI+TmVuaHVtYSBtZW5zYWdlbTwvZGl2PjxkaXYgc3R5bGU9ImZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLXFsLXRleHQtbXV0ZWQsIzcxNzE3YSk7bWFyZ2luLXRvcDo0cHgiPlNldXMgcHJvbXB0cyBlbnZpYWRvcyBhcGFyZWNlcsOjbyBhcXVpLjwvZGl2PjwvZGl2Pg==');
return;
}
let _0x4c06f5=_0xd5('PGRpdiBjbGFzcz0icWwtY2hhdC1tZXNzYWdlcyI+');
let _0x4c07f5='';
for(let _0x4c08f5=0;_0x4c08f5<qlChatHistory.length;_0x4c08f5++){
const _0x4a80f5=qlChatHistory[_0x4c08f5];
const _0x4a81f5=formatChatDate(_0x4a80f5.timestamp);
if(_0x4a81f5!==_0x4c07f5){
_0x4c06f5+=_0xd5('PGRpdiBjbGFzcz0icWwtY2hhdC1kYXRlLWRpdmlkZXIiPjxzcGFuIGNsYXNzPSJxbC1jaGF0LWRhdGUtbGFiZWwiPg==')+_0x4a81f5+_0xd5('PC9zcGFuPjwvZGl2Pg==');
_0x4c07f5=_0x4a81f5;
}
const _0x4a82f5=_0x4a80f5.status===_0xd5('ZXJyb3I=')?_0xd5('cWwtY2hhdC1zdGF0dXMtZXJy'):_0xd5('cWwtY2hhdC1zdGF0dXMtb2s=');
const _0x4a83f5=_0x4a80f5.status===_0xd5('ZXJyb3I=')?SVG_ICONS.x+_0xd5('IEVycm8='):SVG_ICONS.check+_0xd5('IEVudmlhZG8=');
const _0x4a84f5=_0x4a80f5.text.length>300?escapeHtml(_0x4a80f5.text.substring(0,300))+'…':escapeHtml(_0x4a80f5.text);
_0x4c06f5+=_0xd5('PGRpdiBjbGFzcz0icWwtY2hhdC1idWJibGUiIHRpdGxlPSI=')+escapeHtml(_0x4a80f5.text)+'">'+_0x4a84f5+
_0xd5('PGRpdiBjbGFzcz0icWwtY2hhdC1tZXRhIj48c3BhbiBjbGFzcz0i')+_0x4a82f5+'">'+_0x4a83f5+_0xd5('PC9zcGFuPjxzcGFuIGNsYXNzPSJxbC1jaGF0LXRpbWUiPg==')+formatChatTime(_0x4a80f5.timestamp)+_0xd5('PC9zcGFuPjwvZGl2PjwvZGl2Pg==');
}
_0x4c06f5+=_0xd5('PC9kaXY+');
_0x4c06f5+=_0xd5('PGRpdiBjbGFzcz0icWwtY2hhdC1hY3Rpb25zIj48c3BhbiBjbGFzcz0icWwtY2hhdC1jb3VudCI+')+qlChatHistory.length+_0xd5('IG1lbnNhZ2Vu')+(qlChatHistory.length===1?'':'s')+_0xd5('PC9zcGFuPjxidXR0b24gY2xhc3M9InFsLWNoYXQtY2xlYXIiIGlkPSJxbC1jaGF0LWNsZWFyIj48c3BhbiBzdHlsZT0idmVydGljYWwtYWxpZ246bWlkZGxlO2Rpc3BsYXk6aW5saW5lLWZsZXgiPg==')+SVG_ICONS.trash+_0xd5('PC9zcGFuPiBMaW1wYXI8L2J1dHRvbj48L2Rpdj4=');
_0x4c05f5.innerHTML=_0x4c06f5;
const _0x4c09f5=_0x4c05f5.querySelector(_0xd5('LnFsLWNoYXQtbWVzc2FnZXM='));
if(_0x4c09f5)_0x4c09f5.scrollTop=_0x4c09f5.scrollHeight;
const _0x4c0af5=document.getElementById(_0xd5('cWwtY2hhdC1jbGVhcg=='));
if(_0x4c0af5){
_0x4c0af5.addEventListener(_0xd5('Y2xpY2s='),()=>{
qlChatHistory=[];
saveChatHistory();
updateHistoryBadge();
renderHistoryView();
});
}
}
function renderPromptView(){
const _0x4c7ef5=document.getElementById(_0xd5('cWwtdGFiLWNvbnRlbnQ='));
if(!_0x4c7ef5)return;
_0x4c7ef5.innerHTML=
_0xd5('PHRleHRhcmVhIGlkPSJxbC1tc2ciIHJvd3M9IjMiIHBsYWNlaG9sZGVyPSJEaWdpdGUgc2V1IGNvbWFuZG8uLi4iIHNwZWxsY2hlY2s9ImZhbHNlIj48L3RleHRhcmVhPg==')+
_0xd5('PGRpdiBpZD0icWwtYXR0YWNoLXByZXZpZXciIGNsYXNzPSJxbC1hdHRhY2gtcHJldmlldyIgc3R5bGU9ImRpc3BsYXk6bm9uZSI+PC9kaXY+')+
_0xd5('PGRpdiBjbGFzcz0icWwtYWN0aW9uLWJhciI+')+
_0xd5('PGRpdiBjbGFzcz0icWwtYWN0aW9uLWNlbnRlciI+')+
_0xd5('PGJ1dHRvbiBpZD0icWwtYXR0YWNoLWJ0biIgY2xhc3M9InFsLWF0dGFjaC1idG4iIHRpdGxlPSJBbmV4YXIgYXJxdWl2byAobcOheC4gMTApIj7wn5OOPC9idXR0b24+')+
_0xd5('PGJ1dHRvbiBpZD0icWwtb3B0aW1pemUtYnRuIiBjbGFzcz0icWwtdG9vbC1idG4iIHRpdGxlPSJPdGltaXphciBjb20gSUEiPg==')+SVG_ICONS.sparkles+_0xd5('PC9idXR0b24+')+
_0xd5('PGJ1dHRvbiBpZD0icWwtc3BlZWNoLWJ0biIgY2xhc3M9InFsLXRvb2wtYnRuIiB0aXRsZT0iVm96IHBhcmEgdGV4dG8iPg==')+SVG_ICONS.mic+_0xd5('PC9idXR0b24+')+
_0xd5('PC9kaXY+')+
_0xd5('PGRpdiBjbGFzcz0icWwtYWN0aW9uLXJpZ2h0LXNlbmQiPg==')+
_0xd5('PGJ1dHRvbiBpZD0icWwtc2VuZCIgY2xhc3M9InFsLXNlbmQtYnRuIj5FbnZpYXI8L2J1dHRvbj4=')+
_0xd5('PC9kaXY+')+
_0xd5('PC9kaXY+')+
_0xd5('PGlucHV0IHR5cGU9ImZpbGUiIGlkPSJxbC1maWxlLWlucHV0IiBtdWx0aXBsZSBzdHlsZT0iZGlzcGxheTpub25lIiBhY2NlcHQ9IiovKiI+')+
_0xd5('PGRpdiBpZD0icWwtbG9nIj48L2Rpdj4=')+
_0xd5('PGRpdiBjbGFzcz0icWwtc2hvcnRjdXRzLXNlY3Rpb24iPg==')+
_0xd5('PHNwYW4gY2xhc3M9InFsLXNob3J0Y3V0cy10aXRsZSI+QVRBTEhPUyBSw4FQSURPUzwvc3Bhbj4=')+
_0xd5('PGRpdiBjbGFzcz0icWwtc2hvcnRjdXRzLWdyaWQiIGlkPSJxbC1jaGlwcyI+PC9kaXY+')+
_0xd5('PC9kaXY+')+
_0xd5('PGJ1dHRvbiBpZD0icWwtcmVtb3ZlLXdhdGVybWFyayIgY2xhc3M9InFsLXdhdGVybWFyay1idG4iPvCfmqsgUmVtb3ZlciBNYXJjYSBkZSDDgWd1YTwvYnV0dG9uPg==')+
_0xd5('PGJ1dHRvbiBpZD0icWwtZG93bmxvYWQtcHJvamVjdCIgY2xhc3M9InFsLXdhdGVybWFyay1idG4iIHN0eWxlPSJiYWNrZ3JvdW5kOmxpbmVhci1ncmFkaWVudCgxMzVkZWcscmdiYSg1OSwxMzAsMjQ2LDAuMTIpLHJnYmEoMzcsOTksMjM1LDAuMDgpKTtib3JkZXItY29sb3I6cmdiYSg1OSwxMzAsMjQ2LDAuMyk7Y29sb3I6IzYwYTVmYTttYXJnaW4tdG9wOjZweCI+8J+TpSBCYWl4YXIgVG9kb3MgQXJxdWl2b3M8L2J1dHRvbj4=')+
_0xd5('PGJ1dHRvbiBpZD0icWwtY3JlYXRlLXByb2plY3QiIGNsYXNzPSJxbC13YXRlcm1hcmstYnRuIiBzdHlsZT0iYmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoMTM1ZGVnLHJnYmEoMzQsMTk3LDk0LDAuMTQpLHJnYmEoMTYsMTg1LDEyOSwwLjA4KSk7Ym9yZGVyLWNvbG9yOnJnYmEoMzQsMTk3LDk0LDAuMzUpO2NvbG9yOiM0YWRlODA7bWFyZ2luLXRvcDo2cHgiPvCfmoAgQ3JpYXIgUHJvamV0byBubyBMb3ZhYmxlPC9idXR0b24+')+
_0xd5('PGJ1dHRvbiBpZD0icWwtcHVibGlzaC1wcm9qZWN0IiBjbGFzcz0icWwtd2F0ZXJtYXJrLWJ0biIgc3R5bGU9ImJhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KDEzNWRlZyxyZ2JhKDI0NSwxNTgsMTEsMC4xNCkscmdiYSgyMTcsMTE5LDYsMC4wOCkpO2JvcmRlci1jb2xvcjpyZ2JhKDI0NSwxNTgsMTEsMC4zNSk7Y29sb3I6I2ZiYmYyNDttYXJnaW4tdG9wOjZweCI+8J+MkCBQdWJsaWNhciBQcm9qZXRvPC9idXR0b24+')+
_0xd5('PGRpdiBpZD0icWwtZG93bmxvYWQtc3RhdHVzIiBzdHlsZT0iZGlzcGxheTpub25lIj48L2Rpdj4=');
setupSend();
setupSuggestionChips();
setupWatermarkButton();
setupOptimize();
setupSpeech();
setupModoPlano();
setupFileAttachment();
setupShield();
setupNativeChatButton();
setupClipboardPaste();
setupDownloadProject();
setupCreateProject();
setupPublishProject();
}
function setupTabs(){
const _0x4c8ef5=document.querySelectorAll(_0xd5('LnFsLXRhYg=='));
_0x4c8ef5.forEach(_0x4c97f5=>{
_0x4c97f5.addEventListener(_0xd5('Y2xpY2s='),()=>{
const _0x4cc2f5=_0x4c97f5.getAttribute(_0xd5('ZGF0YS10YWI='));
qlActiveTab=_0x4cc2f5;
document.querySelectorAll(_0xd5('LnFsLXRhYg==')).forEach(_0x4cbef5=>_0x4cbef5.classList.toggle(_0xd5('cWwtdGFiLWFjdGl2ZQ=='),_0x4cbef5.getAttribute(_0xd5('ZGF0YS10YWI='))===_0x4cc2f5));
if(_0x4cc2f5===_0xd5('aGlzdG9yeQ==')){
loadChatHistory(()=>renderHistoryView());
}else{
renderPromptView();
}
});
});
}
const MAX_FILES=10;
const MAX_FILE_SIZE=20*1024*1024;
let qlAttachedFiles=[];
function formatFileSize(_0x4ceaf5){
if(_0x4ceaf5<1024)return _0x4ceaf5+' B';
if(_0x4ceaf5<1024*1024)return(_0x4ceaf5/1024).toFixed(1)+' KB';
return(_0x4ceaf5/(1024*1024)).toFixed(1)+' MB';
}
function isImageType(_0x4cf7f5){
return[_0xd5('aW1hZ2UvcG5n'),_0xd5('aW1hZ2UvanBlZw=='),_0xd5('aW1hZ2Uvd2VicA==')].includes(_0x4cf7f5);
}
async function compressImage(file){
return new Promise((_0x5085f5)=>{
const _0x5086f5=new Image();
const _0x5087f5=URL.createObjectURL(file);
_0x5086f5.onload=()=>{
URL.revokeObjectURL(_0x5087f5);
const _0x5060f5=1280;
let _0x5061f5=_0x5086f5.width,_0x5062f5=_0x5086f5.height;
if(_0x5061f5>_0x5060f5||_0x5062f5>_0x5060f5){
const _0x4e31f5=Math.min(_0x5060f5/_0x5061f5,_0x5060f5/_0x5062f5);
_0x5061f5=Math.round(_0x5061f5*_0x4e31f5);
_0x5062f5=Math.round(_0x5062f5*_0x4e31f5);
}
const _0x5063f5=document.createElement(_0xd5('Y2FudmFz'));
_0x5063f5.width=_0x5061f5;_0x5063f5.height=_0x5062f5;
const _0x5064f5=_0x5063f5.getContext('2d');
_0x5064f5.drawImage(_0x5086f5,0,0,_0x5061f5,_0x5062f5);
const _0x5065f5=file.type===_0xd5('aW1hZ2UvcG5n')?_0xd5('aW1hZ2UvcG5n'):_0xd5('aW1hZ2UvanBlZw==');
const _0x5066f5=file.type===_0xd5('aW1hZ2UvcG5n')?undefined:0.8;
_0x5063f5.toBlob((_0x5057f5)=>{
if(!_0x5057f5)return _0x5085f5({file,previewUrl:null});
const _0x5058f5=new File([_0x5057f5],file.name,{type:_0x5065f5});
const previewUrl=URL.createObjectURL(_0x5057f5);
_0x5085f5({file:_0x5058f5,previewUrl});
},_0x5065f5,_0x5066f5);
};
_0x5086f5.onerror=()=>{URL.revokeObjectURL(_0x5087f5);_0x5085f5({file,previewUrl:null});};
_0x5086f5.src=_0x5087f5;
});
}
function fileToBase64(_0x508ef5){
return new Promise((_0x50e9f5,_0x50eaf5)=>{
const _0x50ebf5=new FileReader();
_0x50ebf5.onload=()=>{
const _0x50caf5=_0x50ebf5.result.split(',')[1];
_0x50e9f5(_0x50caf5);
};
_0x50ebf5.onerror=()=>_0x50eaf5(new Error(_0xd5('RmFsaGEgYW8gbGVyIGFycXVpdm8=')));
_0x50ebf5.readAsDataURL(_0x508ef5);
});
}
function decodeJwtUserId(_0x5126f5){
const _0x5127f5=decodeJwtPayload(_0x5126f5);
if(!_0x5127f5||typeof _0x5127f5!==_0xd5('b2JqZWN0'))return null;
return _0x5127f5.sub||_0x5127f5.user_id||null;
}
const UPLOAD_IMAGE_EDGE_URL=_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9mdW5jdGlvbnMvdjEvdXBsb2FkLXByb21wdC1pbWFnZQ==');
const IMAGE_MIME_TYPES=[_0xd5('aW1hZ2UvanBlZw=='),_0xd5('aW1hZ2UvcG5n'),_0xd5('aW1hZ2Uvd2VicA=='),_0xd5('aW1hZ2UvZ2lm')];
async function uploadImageToStorage(_0x5432f5){
const _0x5433f5=_0x5432f5.type||_0xd5('aW1hZ2UvcG5n');
const base64=await new Promise((_0x5210f5,_0x5211f5)=>{
const _0x5212f5=new FileReader();
_0x5212f5.onload=()=>{
const _0x51f0f5=String(_0x5212f5.result||'');
const _0x51f1f5=_0x51f0f5.indexOf(',');
_0x5210f5(_0x51f1f5>=0?_0x51f0f5.slice(_0x51f1f5+1):_0x51f0f5);
};
_0x5212f5.onerror=()=>_0x5211f5(new Error(_0xd5('RmFsaGEgYW8gbGVyIGFycXVpdm8=')));
_0x5212f5.readAsDataURL(_0x5432f5);
});
const _0x5434f5=await new Promise(_0x523df5=>chrome.storage.local.get([_0xd5('cWxfbGljZW5zZV9rZXk=')],_0x523df5));
const _0x5435f5=_0x5434f5.ql_license_key||'';
const _0x5436f5=await bgFetch(UPLOAD_IMAGE_EDGE_URL,{
method:_0xd5('UE9TVA=='),
headers:{
'Content-Type':_0xd5('YXBwbGljYXRpb24vanNvbg=='),
apikey:SUPABASE_ANON_KEY,
Authorization:_0xd5('QmVhcmVyIA==')+SUPABASE_ANON_KEY,
},
body:JSON.stringify({
license_key:_0x5435f5,
file_name:_0x5432f5.name||_0xd5('aW1hZ2UucG5n'),
content_type:_0x5433f5,
base64,
}),
});
if(!_0x5436f5||_0x5436f5.success===false||!_0x5436f5.url){
throw new Error((_0x5436f5&&(_0x5436f5.error_display||_0x5436f5.error))||_0xd5('RmFsaGEgbm8gdXBsb2FkIGRhIGltYWdlbQ=='));
}
return{
file_id:_0x5436f5.path||(_0xd5('aW1nXw==')+crypto.randomUUID()),
file_name:_0x5432f5.name||_0xd5('aW1hZ2U='),
download_url:normalizePromptImageUrl(_0x5436f5.url),
is_temp_image:true,
};
}
async function uploadFileDirect(_0x5e90f5,_0x5e91f5){
if(IMAGE_MIME_TYPES.includes(_0x5e90f5.type)){
return await uploadImageToStorage(_0x5e90f5);
}
const _0x5e92f5=crypto.randomUUID();
const _0x5e93f5=decodeJwtUserId(_0x5e91f5);
if(!_0x5e93f5)throw new Error(_0xd5('TsOjbyBmb2kgcG9zc8OtdmVsIGV4dHJhaXIgdXNlcklkIGRvIHRva2Vu'));
const _0x5e94f5=(_0x577ff5)=>{
if(_0x577ff5&&typeof _0x577ff5.type===_0xd5('c3RyaW5n')&&_0x577ff5.type.trim())return _0x577ff5.type;
const _0x5780f5=(_0x577ff5&&_0x577ff5.name?_0x577ff5.name:'').toLowerCase();
const _0x5781f5=_0x5780f5.includes('.')?_0x5780f5.split('.').pop():'';
const _0x5782f5={
pdf:_0xd5('YXBwbGljYXRpb24vcGRm'),
txt:_0xd5('dGV4dC9wbGFpbg=='),
csv:_0xd5('dGV4dC9jc3Y='),
json:_0xd5('YXBwbGljYXRpb24vanNvbg=='),
zip:_0xd5('YXBwbGljYXRpb24vemlw'),
doc:_0xd5('YXBwbGljYXRpb24vbXN3b3Jk'),
docx:_0xd5('YXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuZG9jdW1lbnQ='),
xls:_0xd5('YXBwbGljYXRpb24vdm5kLm1zLWV4Y2Vs'),
xlsx:_0xd5('YXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnNwcmVhZHNoZWV0bWwuc2hlZXQ='),
ppt:_0xd5('YXBwbGljYXRpb24vdm5kLm1zLXBvd2VycG9pbnQ='),
pptx:_0xd5('YXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnByZXNlbnRhdGlvbm1sLnByZXNlbnRhdGlvbg=='),
mp3:_0xd5('YXVkaW8vbXBlZw=='),
wav:_0xd5('YXVkaW8vd2F2'),
mp4:_0xd5('dmlkZW8vbXA0'),
webm:_0xd5('dmlkZW8vd2VibQ==')
};
return _0x5782f5[_0x5781f5]||_0xd5('YXBwbGljYXRpb24vb2N0ZXQtc3RyZWFt');
};
const _0x5e95f5=(_0x58c6f5,_0x58c7f5)=>{
const _0x58c8f5=_0x58c7f5&&_0x58c7f5.name?String(_0x58c7f5.name):'';
const _0x58c9f5=_0x58c8f5.includes('.')?_0x58c8f5.split('.').pop().toLowerCase():'';
const _0x58caf5=_0x58c9f5&&/^[a-z0-9]{1,10}$/.test(_0x58c9f5)?_0x58c9f5:'bin';
return _0x58c6f5+'.'+_0x58caf5;
};
const _0x5e96f5=_0x5e94f5(_0x5e90f5);
const _0x5e97f5=_0x5e95f5(_0x5e92f5,_0x5e90f5);
const _0x5e98f5=await bgFetch(_0xd5('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXYvZmlsZXMvZ2VuZXJhdGUtdXBsb2FkLXVybA=='),{
method:_0xd5('UE9TVA=='),
headers:{
'Content-Type':_0xd5('YXBwbGljYXRpb24vanNvbg=='),
'Authorization':_0xd5('QmVhcmVyIA==')+_0x5e91f5
},
body:JSON.stringify({
file_name:_0x5e97f5,
content_type:_0x5e96f5,
status:_0xd5('dXBsb2FkaW5n')
})
});
var _0x5e99f5=(_0x5e98f5&&_0x5e98f5.url)||(_0x5e98f5&&_0x5e98f5.signed_url)||(_0x5e98f5&&_0x5e98f5.signedUrl)||(_0x5e98f5&&_0x5e98f5.data&&_0x5e98f5.data.url)||null;
if(!_0x5e99f5)throw new Error(_0xd5('VVJMIGFzc2luYWRhIG7Do28gcmV0b3JuYWRh'));
await new Promise((_0x5d59f5,_0x5d5af5)=>{
const _0x5d5bf5=new FileReader();
_0x5d5bf5.onload=()=>{
const _0x5d3af5=new XMLHttpRequest();
_0x5d3af5.open('PUT',_0x5e99f5,true);
_0x5d3af5.setRequestHeader(_0xd5('Q29udGVudC1UeXBl'),_0x5e96f5);
_0x5d3af5.onload=()=>{
if(_0x5d3af5.status>=200&&_0x5d3af5.status<300)_0x5d59f5({ok:true});
else _0x5d5af5(new Error(_0xd5('VXBsb2FkIFBVVCBmYWxob3U6IA==')+_0x5d3af5.status));
};
_0x5d3af5.onerror=()=>_0x5d5af5(new Error(_0xd5('RXJybyBkZSByZWRlIG5vIHVwbG9hZA==')));
_0x5d3af5.send(_0x5e90f5);
};
_0x5d5bf5.onerror=()=>_0x5d5af5(new Error(_0xd5('RmFsaGEgYW8gbGVyIGFycXVpdm8=')));
_0x5d5bf5.readAsArrayBuffer(_0x5e90f5);
});
let _0x5e9af5='';
try{
const _0x5dd2f5=await bgFetch(_0xd5('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXYvZmlsZXMvZ2VuZXJhdGUtZG93bmxvYWQtdXJs'),{
method:_0xd5('UE9TVA=='),
headers:{
'Content-Type':_0xd5('YXBwbGljYXRpb24vanNvbg=='),
'Authorization':_0xd5('QmVhcmVyIA==')+_0x5e91f5
},
body:JSON.stringify({
dir_name:_0x5e93f5,
file_name:_0x5e97f5
})
});
_0x5e9af5=(_0x5dd2f5&&(_0x5dd2f5.url||_0x5dd2f5.signed_url||_0x5dd2f5.signedUrl||(_0x5dd2f5.data&&_0x5dd2f5.data.url)))||'';
}catch(_0x5dd4f5){
console.warn(_0xd5('W1FMIFVwbG9hZF0gZG93bmxvYWQtdXJsIGNvbmZpcm1hdGlvbiBmYWlsZWQgKG5vbi1jcml0aWNhbCk6'),_0x5dd4f5);
}
return{file_id:_0x5e97f5,file_name:_0x5e90f5.name||_0xd5('ZmlsZQ=='),download_url:_0x5e9af5,is_temp_image:false};
}
function applyUploadResult(_0x5f0ff5,_0x5f10f5){
_0x5f0ff5.file_id=_0x5f10f5.file_id||null;
_0x5f0ff5.file_name=_0x5f10f5.file_name||_0x5f0ff5.file_name;
_0x5f0ff5.download_url=_0x5f10f5.download_url||'';
_0x5f0ff5.is_temp_image=!!_0x5f10f5.is_temp_image;
_0x5f0ff5.uploading=false;
_0x5f0ff5.uploadFailed=false;
}
function applyUploadFailure(_0x5f37f5){
_0x5f37f5.uploading=false;
_0x5f37f5.uploadFailed=true;
_0x5f37f5.is_temp_image=false;
_0x5f37f5.download_url='';
_0x5f37f5.file_id=_0xd5('bG9jYWxfZGlyZWN0Xw==')+crypto.randomUUID();
}
function renderAttachPreview(){
const _0x60c2f5=document.getElementById(_0xd5('cWwtYXR0YWNoLXByZXZpZXc='));
if(!_0x60c2f5)return;
if(qlAttachedFiles.length===0){
_0x60c2f5.style.display=_0xd5('bm9uZQ==');
_0x60c2f5.innerHTML='';
return;
}
_0x60c2f5.style.display=_0xd5('ZmxleA==');
_0x60c2f5.innerHTML=qlAttachedFiles.map((_0x60b4f5,_0x60b5f5)=>{
const _0x60b6f5=_0x60b4f5.previewUrl
?_0xd5('PGltZyBjbGFzcz0icWwtYXR0YWNoLXRodW1iIiBzcmM9Ig==')+_0x60b4f5.previewUrl+_0xd5('IiBhbHQ9IiI+')
:_0xd5('PGRpdiBjbGFzcz0icWwtYXR0YWNoLWljb24iPg==')+SVG_ICONS.file+_0xd5('PC9kaXY+');
const _0x60b7f5=_0x60b4f5.uploading?_0xd5('IHFsLWF0dGFjaC11cGxvYWRpbmc='):'';
return_0xd5('PGRpdiBjbGFzcz0icWwtYXR0YWNoLWl0ZW0=')+_0x60b7f5+_0xd5('IiBkYXRhLWlkeD0i')+_0x60b5f5+'">'+
_0x60b6f5+
_0xd5('PGRpdiBjbGFzcz0icWwtYXR0YWNoLWluZm8iPjxzcGFuIGNsYXNzPSJxbC1hdHRhY2gtbmFtZSIgdGl0bGU9Ig==')+escapeHtml(_0x60b4f5.file_name)+'">'+escapeHtml(_0x60b4f5.file_name)+_0xd5('PC9zcGFuPjxzcGFuIGNsYXNzPSJxbC1hdHRhY2gtc2l6ZSI+')+escapeHtml(_0x60b4f5.sizeLabel)+_0xd5('PC9zcGFuPjwvZGl2Pg==')+
_0xd5('PGJ1dHRvbiBjbGFzcz0icWwtYXR0YWNoLXJlbW92ZSIgZGF0YS1pZHg9Ig==')+_0x60b5f5+'">'+SVG_ICONS.x+_0xd5('PC9idXR0b24+')+
_0xd5('PC9kaXY+');
}).join('');
_0x60c2f5.querySelectorAll(_0xd5('LnFsLWF0dGFjaC1yZW1vdmU=')).forEach(_0x60cbf5=>{
_0x60cbf5.addEventListener(_0xd5('Y2xpY2s='),(_0x6116f5)=>{
_0x6116f5.stopPropagation();
const _0x6117f5=parseInt(_0x60cbf5.getAttribute(_0xd5('ZGF0YS1pZHg=')));
if(qlAttachedFiles[_0x6117f5]&&qlAttachedFiles[_0x6117f5].previewUrl){
URL.revokeObjectURL(qlAttachedFiles[_0x6117f5].previewUrl);
}
qlAttachedFiles.splice(_0x6117f5,1);
renderAttachPreview();
});
});
}
function setupFileAttachment(){
const _0x6162f5=document.getElementById(_0xd5('cWwtYXR0YWNoLWJ0bg=='));
const _0x6163f5=document.getElementById(_0xd5('cWwtZmlsZS1pbnB1dA=='));
if(!_0x6162f5||!_0x6163f5)return;
_0x6162f5.addEventListener(_0xd5('Y2xpY2s='),()=>{
if(qlAttachedFiles.length>=MAX_FILES){
showCustomAlert(_0xd5('TGltaXRl'),_0xd5('TcOheGltbyBkZSA=')+MAX_FILES+_0xd5('IGFycXVpdm9zLg=='));
return;
}
_0x6163f5.click();
});
_0x6163f5.addEventListener(_0xd5('Y2hhbmdl'),async()=>{
const _0x6182f5=Array.from(_0x6163f5.files||[]);
_0x6163f5.value='';
if(!_0x6182f5.length)return;
await handleFilesAttach(_0x6182f5);
});
}
function setupSend(){
const _0x6197f5=document.getElementById(_0xd5('cWwtc2VuZA=='));
if(!_0x6197f5)return;
_0x6197f5.addEventListener(_0xd5('Y2xpY2s='),async()=>{
var _0x64b3f5=document.getElementById(_0xd5('cWwtbXNn'));
const _0x64b4f5=_0x64b3f5?(_0x64b3f5.value||"").trim():"";
const _0x64b5f5=false;
const _0x64b6f5=document.getElementById(_0xd5('cWwtbG9n'));
if(!_0x64b4f5){
if(_0x64b6f5){_0x64b6f5.className=_0xd5('cWwtbG9nLWVycm9y');_0x64b6f5.innerText=_0xd5('UHJvbXB0IHZhemlv');}
return;
}
const _0x64b7f5=qlAttachedFiles.map((_0x6368f5)=>({..._0x6368f5}));
const _0x64b8f5=await new Promise((_0x63b4f5)=>{
chrome.storage.local.get([_0xd5('cWxfbGljZW5zZV9rZXk='),_0xd5('cWxfc2Vzc2lvbl9pZA==')],_0x63b4f5);
});
const _0x64b9f5=_0x64b8f5.ql_license_key||"";
const _0x64baf5=_0x64b7f5.some(_0x6459f5=>_0x6459f5.is_temp_image&&!_0x6459f5.uploading&&!_0x6459f5.uploadFailed);
const _0x64bbf5=_0x64b7f5.some(_0x64b2f5=>!_0x64b2f5.is_temp_image&&(_0x64b2f5.file_id||_0x64b2f5.rawFile)&&!_0x64b2f5.uploading);
try{
if(_0x64b6f5){
_0x64b6f5.className=_0xd5('cWwtbG9nLWluZm8=');
_0x64b6f5.innerText=_0x64baf5||_0x64bbf5?_0xd5('UHJlcGFyYW5kbyBhbmV4b3MgcGFyYSBlbnZpby4uLg=='):_0xd5('RW52aWFuZG8gcHJvbXB0Li4u');
}
_0x6197f5.classList.add(_0xd5('cWwtc2VuZGluZw=='));
_0x6197f5.disabled=true;
var _0x64bcf5=_0x64b7f5.some(_0x64c6f5=>_0x64c6f5.uploading&&!_0x64c6f5.rawFile);
if(_0x64bcf5){
throw new Error(_0xd5('QWd1YXJkZSBvIHVwbG9hZCBkb3MgYXJxdWl2b3MgdGVybWluYXIu'));
}
await sendPromptNativeViaBackground(_0x64b4f5,_0x64b5f5,_0x64b7f5);
if(_0x64b6f5){
_0x64b6f5.className=_0xd5('cWwtbG9nLXN1Y2Nlc3M=');
if(_0x64baf5&&_0x64bbf5){
_0x64b6f5.innerText=_0xd5('UHJvbXB0IGVudmlhZG8gY29tIGltYWdlbSBlIGFycXVpdm8h');
}else if(_0x64baf5){
_0x64b6f5.innerText=_0xd5('UHJvbXB0IGVudmlhZG8gY29tIGltYWdlbSE=');
}else if(_0x64bbf5){
_0x64b6f5.innerText=_0xd5('UHJvbXB0IGVudmlhZG8gY29tIGFycXVpdm8h');
}else{
_0x64b6f5.innerText=_0xd5('UHJvbXB0IGVudmlhZG8h');
}
}
addToChatHistory(_0x64b4f5,'ok');
var _0x64b3f5=document.getElementById(_0xd5('cWwtbXNn'));
if(_0x64b3f5)_0x64b3f5.value="";
qlAttachedFiles.forEach(_0x64d5f5=>{if(_0x64d5f5.previewUrl)URL.revokeObjectURL(_0x64d5f5.previewUrl);});
qlAttachedFiles=[];
renderAttachPreview();
}catch(_0x64d7f5){
if(_0x64b6f5){_0x64b6f5.className=_0xd5('cWwtbG9nLWVycm9y');_0x64b6f5.innerText=""+(_0x64d7f5.message||_0x64d7f5);}
addToChatHistory(_0x64b4f5,_0xd5('ZXJyb3I='));
}finally{
_0x6197f5.classList.remove(_0xd5('cWwtc2VuZGluZw=='));
_0x6197f5.disabled=false;
}
});
}
let _dragCleanup=null;
let _resizeCleanup=null;
function setupDrag(){
if(_dragCleanup){_dragCleanup();_dragCleanup=null;}
const _0x6919f5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='));
const _0x691af5=document.getElementById(_0xd5('cWwtaGVhZGVy'));
if(!_0x6919f5||!_0x691af5)return;
let _0x691bf5=false,_0x691cf5=0,_0x691df5=0,_0x691ef5=0,_0x691ff5=0;
function _0x6920f5(_0x6766f5){
if(_0x6766f5.target.closest(_0xd5('LnFsLW1pbmltaXplLWJ0bg=='))||_0x6766f5.target.closest(_0xd5('LnFsLWljb24tYnRu'))||_0x6766f5.target.closest(_0xd5('YnV0dG9u')))return;
if(_0x6766f5.pointerType===_0xd5('bW91c2U=')&&_0x6766f5.button!==0)return;
_0x6766f5.preventDefault();
const _0x6767f5=_0x6919f5.getBoundingClientRect();
_0x691cf5=_0x6766f5.clientX;_0x691df5=_0x6766f5.clientY;
_0x691ef5=_0x6767f5.left;_0x691ff5=_0x6767f5.top;
_0x691bf5=true;
try{_0x691af5.setPointerCapture(_0x6766f5.pointerId);}catch(_0x6737f5){}
document.addEventListener(_0xd5('cG9pbnRlcm1vdmU='),_0x6921f5);
document.addEventListener(_0xd5('cG9pbnRlcnVw'),_0x6922f5);
document.body.style.userSelect=_0xd5('bm9uZQ==');
}
function _0x6921f5(_0x686df5){
if(!_0x691bf5)return;
let _0x686ef5=_0x691ef5+(_0x686df5.clientX-_0x691cf5);
let _0x686ff5=_0x691ff5+(_0x686df5.clientY-_0x691df5);
_0x686ef5=Math.max(0,Math.min(_0x686ef5,window.innerWidth-_0x6919f5.offsetWidth));
_0x686ff5=Math.max(0,Math.min(_0x686ff5,window.innerHeight-_0x6919f5.offsetHeight));
_0x6919f5.style.left=_0x686ef5+"px";
_0x6919f5.style.top=_0x686ff5+"px";
}
function _0x6922f5(_0x6896f5){
if(!_0x691bf5)return;
_0x691bf5=false;
try{_0x691af5.releasePointerCapture(_0x6896f5.pointerId);}catch(_0x687ef5){}
document.removeEventListener(_0xd5('cG9pbnRlcm1vdmU='),_0x6921f5);
document.removeEventListener(_0xd5('cG9pbnRlcnVw'),_0x6922f5);
document.body.style.userSelect="";
}
_0x691af5.addEventListener(_0xd5('cG9pbnRlcmRvd24='),_0x6920f5,{passive:false});
_dragCleanup=function(){
_0x691af5.removeEventListener(_0xd5('cG9pbnRlcmRvd24='),_0x6920f5);
document.removeEventListener(_0xd5('cG9pbnRlcm1vdmU='),_0x6921f5);
document.removeEventListener(_0xd5('cG9pbnRlcnVw'),_0x6922f5);
};
}
function setupResize(){
if(_resizeCleanup){_resizeCleanup();_resizeCleanup=null;}
const _0x6b8af5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='));
const _0x6b8bf5=document.getElementById(_0xd5('cWwtcmVzaXplLWhhbmRsZQ=='));
if(!_0x6b8af5||!_0x6b8bf5)return;
let _0x6b8cf5=false,_0x6b8df5=0,_0x6b8ef5=0;
function _0x6b8ff5(_0x6a8bf5){
_0x6a8bf5.preventDefault();
_0x6a8bf5.stopPropagation();
_0x6b8cf5=true;
_0x6b8df5=_0x6a8bf5.clientY;
_0x6b8ef5=_0x6b8af5.offsetHeight;
try{_0x6b8bf5.setPointerCapture(_0x6a8bf5.pointerId);}catch(_0x6a73f5){}
document.addEventListener(_0xd5('cG9pbnRlcm1vdmU='),_0x6b90f5);
document.addEventListener(_0xd5('cG9pbnRlcnVw'),_0x6b91f5);
document.body.style.userSelect=_0xd5('bm9uZQ==');
}
function _0x6b90f5(_0x6ae6f5){
if(!_0x6b8cf5)return;
let _0x6ae7f5=_0x6b8ef5+(_0x6ae6f5.clientY-_0x6b8df5);
_0x6ae7f5=Math.max(200,Math.min(_0x6ae7f5,window.innerHeight*0.8));
_0x6b8af5.style.height=_0x6ae7f5+"px";
}
function _0x6b91f5(_0x6b21f5){
if(!_0x6b8cf5)return;
_0x6b8cf5=false;
qlHeight=_0x6b8af5.offsetHeight;
chrome.storage.local.set({ql_height:qlHeight});
try{_0x6b8bf5.releasePointerCapture(_0x6b21f5.pointerId);}catch(_0x6b09f5){}
document.removeEventListener(_0xd5('cG9pbnRlcm1vdmU='),_0x6b90f5);
document.removeEventListener(_0xd5('cG9pbnRlcnVw'),_0x6b91f5);
document.body.style.userSelect="";
}
_0x6b8bf5.addEventListener(_0xd5('cG9pbnRlcmRvd24='),_0x6b8ff5,{passive:false});
_resizeCleanup=function(){
_0x6b8bf5.removeEventListener(_0xd5('cG9pbnRlcmRvd24='),_0x6b8ff5);
document.removeEventListener(_0xd5('cG9pbnRlcm1vdmU='),_0x6b90f5);
document.removeEventListener(_0xd5('cG9pbnRlcnVw'),_0x6b91f5);
};
}
function setupClipboardPaste(){
var _0x6d41f5=document.getElementById(_0xd5('cWwtbXNn'));
if(!_0x6d41f5)return;
var _0x6d42f5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='))||_0x6d41f5;
var _0x6d43f5=null;
function _0x6d44f5(){
if(_0x6d43f5)return;
_0x6d43f5=document.createElement('div');
_0x6d43f5.className=_0xd5('cWwtZHJhZy1vdmVybGF5');
_0x6d43f5.innerHTML=_0xd5('PGRpdiBjbGFzcz0icWwtZHJhZy1vdmVybGF5LWlubmVyIj48c3BhbiBzdHlsZT0idmVydGljYWwtYWxpZ246bWlkZGxlO2Rpc3BsYXk6aW5saW5lLWZsZXgiPg==')+SVG_ICONS.folder+_0xd5('PC9zcGFuPiBTb2x0ZSBvcyBhcnF1aXZvcyBhcXVpPC9kaXY+');
var _0x6c52f5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='));
if(_0x6c52f5)_0x6c52f5.appendChild(_0x6d43f5);
}
function _0x6d45f5(){
if(_0x6d43f5){_0x6d43f5.remove();_0x6d43f5=null;}
}
_0x6d42f5.addEventListener(_0xd5('ZHJhZ292ZXI='),function(_0x6c80f5){_0x6c80f5.preventDefault();_0x6c80f5.stopPropagation();_0x6d44f5();});
_0x6d42f5.addEventListener(_0xd5('ZHJhZ2xlYXZl'),function(_0x6cb7f5){_0x6cb7f5.preventDefault();_0x6cb7f5.stopPropagation();if(!_0x6d42f5.contains(_0x6cb7f5.relatedTarget))_0x6d45f5();});
_0x6d42f5.addEventListener(_0xd5('ZHJvcA=='),async function(_0x6d26f5){
_0x6d26f5.preventDefault();_0x6d26f5.stopPropagation();_0x6d45f5();
var _0x6d27f5=Array.from(_0x6d26f5.dataTransfer.files||[]);
if(!_0x6d27f5.length)return;
await handleFilesAttach(_0x6d27f5);
});
_0x6d41f5.addEventListener(_0xd5('cGFzdGU='),async function(_0x6e54f5){
var _0x6e55f5=_0x6e54f5.clipboardData&&_0x6e54f5.clipboardData.items;
if(!_0x6e55f5)return;
var _0x6e56f5=[];
for(var _0x6e57f5=0;_0x6e57f5<_0x6e55f5.length;_0x6e57f5++){
var _0x6e58f5=_0x6e55f5[_0x6e57f5];
if(_0x6e58f5.kind===_0xd5('ZmlsZQ==')){
_0x6e54f5.preventDefault();
var _0x6e59f5=_0x6e58f5.getAsFile();
if(_0x6e59f5)_0x6e56f5.push(_0x6e59f5);
}
}
if(_0x6e56f5.length>0)await handleFilesAttach(_0x6e56f5);
});
}
async function handleFilesAttach(_0x7120f5){
if(qlAttachedFiles.length>=MAX_FILES){
showCustomAlert(_0xd5('TGltaXRl'),_0xd5('TWF4aW1vIA==')+MAX_FILES+_0xd5('IGFycXVpdm9zLg=='));
return;
}
var _0x7121f5=await new Promise(function(_0x6f18f5){chrome.storage.local.get([_0xd5('bG92YWJsZV90b2tlbg==')],_0x6f18f5);});
var _0x7122f5=_0x7121f5.lovable_token||'';
if(!_0x7122f5){showCustomAlert(_0xd5('RXJybw=='),_0xd5('VG9rZW4gbmFvIGNhcHR1cmFkby4='));return;}
if(_0x7122f5.indexOf(_0xd5('QmVhcmVyIA=='))===0)_0x7122f5=_0x7122f5.slice(7);
for(var _0x7123f5=0;_0x7123f5<_0x7120f5.length;_0x7123f5++){
var _0x7124f5=_0x7120f5[_0x7123f5];
if(qlAttachedFiles.length>=MAX_FILES)break;
if(_0x7124f5.size>MAX_FILE_SIZE){showCustomAlert(_0xd5('R3JhbmRl'),_0x7124f5.name+_0xd5('IGV4Y2VkZSAyME1CLg=='));continue;}
var _0x7125f5=_0x7124f5;
var _0x7126f5=null;
if(IMAGE_MIME_TYPES.indexOf(_0x7124f5.type)>=0){
var _0x7127f5=await compressImage(_0x7124f5);
_0x7125f5=_0x7127f5.file;
_0x7126f5=_0x7127f5.previewUrl;
}
var _0x7128f5=qlAttachedFiles.length;
var _0x7129f5=/\.zip$/i.test(_0x7124f5.name||'')||_0x7125f5.type===_0xd5('YXBwbGljYXRpb24vemlw')||_0x7125f5.type===_0xd5('YXBwbGljYXRpb24veC16aXAtY29tcHJlc3NlZA==');
qlAttachedFiles.push({
file_id:null,
file_name:_0x7124f5.name||(_0xd5('ZmlsZV8=')+Date.now()),
previewUrl:_0x7126f5,
file_type:_0x7125f5.type,
sizeLabel:formatFileSize(_0x7125f5.size),
uploading:!_0x7129f5,
uploadFailed:false,
is_temp_image:false,
rawFile:_0x7125f5
});
renderAttachPreview();
if(_0x7129f5){
qlAttachedFiles[_0x7128f5].file_id=_0xd5('aW5saW5lX3ppcF8=')+crypto.randomUUID();
qlAttachedFiles[_0x7128f5].uploading=false;
qlAttachedFiles[_0x7128f5].uploadFailed=false;
renderAttachPreview();
continue;
}
try{
var _0x712af5=await uploadFileDirect(_0x7125f5,_0x7122f5);
applyUploadResult(qlAttachedFiles[_0x7128f5],_0x712af5);
renderAttachPreview();
}catch(_0x70c7f5){
applyUploadFailure(qlAttachedFiles[_0x7128f5]);
renderAttachPreview();
}
}
showCustomAlert(_0xd5('QW5leGFkbw=='),_0x7120f5.length+_0xd5('IGFycXVpdm8ocykgYWRpY2lvbmFkbyhzKSE='));
}
var USER_ROLES_URL_POPUP=_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9yZXN0L3YxL3VzZXJfcm9sZXM/c2VsZWN0PXJvbGU=');
var CURRENT_EXT_VERSION_POPUP=_0xd5('MTAuMw==');
function setupDownloadProject(){
var _0x713ff5=document.getElementById(_0xd5('cWwtZG93bmxvYWQtcHJvamVjdA=='));
if(!_0x713ff5)return;
_0x713ff5.addEventListener(_0xd5('Y2xpY2s='),async function(){
var _0x72c0f5=document.getElementById(_0xd5('cWwtZG93bmxvYWQtc3RhdHVz'));
_0x713ff5.disabled=true;
_0x713ff5.textContent=_0xd5('UHJlcGFyYW5kby4uLg==');
if(_0x72c0f5){_0x72c0f5.style.display=_0xd5('YmxvY2s=');_0x72c0f5.className=_0xd5('cWwtbG9nLWluZm8=');_0x72c0f5.textContent=_0xd5('VmVyaWZpY2FuZG8gdG9rZW4gZSBwcm9qZXRvLi4u');}
try{
var _0x72c1f5=await new Promise(function(_0x72dff5){chrome.storage.local.get([_0xd5('bG92YWJsZV90b2tlbg=='),_0xd5('bG92YWJsZV9wcm9qZWN0SWQ=')],_0x72dff5);});
var _0x72c2f5=_0x72c1f5.lovable_token||'';
var _0x72c3f5=_0x72c1f5.lovable_projectId||'';
if(_0x72c2f5.indexOf(_0xd5('QmVhcmVyIA=='))===0)_0x72c2f5=_0x72c2f5.slice(7);
var _0x72c4f5=_0x72c3f5;
if(!_0x72c4f5)throw new Error(_0xd5('QWJyYSB1bWEgcGFnaW5hIGRlIHByb2pldG8gZG8gTG92YWJsZSBwcmltZWlyby4='));
if(!_0x72c2f5){
var _0x72c5f5=await new Promise(function(_0x72edf5){
chrome.runtime.sendMessage({action:_0xd5('cmVhZENvb2tpZXM=')},function(_0x72f4f5){_0x72edf5(_0x72f4f5);});
});
if(_0x72c5f5&&_0x72c5f5.success&&_0x72c5f5.tokens&&_0x72c5f5.tokens.length>0){
_0x72c2f5=_0x72c5f5.tokens[0].token;
}
}
if(!_0x72c2f5)throw new Error(_0xd5('VG9rZW4gbmFvIGVuY29udHJhZG8uIEFicmEgdW0gcHJvamV0byBubyBMb3ZhYmxlIGUgYWd1YXJkZSBhIHNpbmNyb25pemFjYW8u'));
_0x713ff5.textContent=_0xd5('QmFpeGFuZG8uLi4=');
if(_0x72c0f5)_0x72c0f5.textContent=_0xd5('QmFpeGFuZG8gYXJxdWl2b3MgZG8gcHJvamV0by4uLg==');
var _0x72c6f5=await new Promise(function(_0x7308f5){
chrome.runtime.sendMessage({action:_0xd5('ZG93bmxvYWRQcm9qZWN0'),projectId:_0x72c4f5,token:_0x72c2f5},function(_0x730ff5){_0x7308f5(_0x730ff5);});
});
if(!_0x72c6f5||!_0x72c6f5.success)throw new Error(_0x72c6f5&&_0x72c6f5.error?_0x72c6f5.error:_0xd5('RG93bmxvYWQgZmFsaG91'));
var _0x72c7f5=_0x72c6f5.files;
if(!_0x72c7f5||_0x72c7f5.length===0)throw new Error(_0xd5('TmVuaHVtIGFycXVpdm8gZW5jb250cmFkbyBubyBwcm9qZXRvLg=='));
if(_0x72c0f5)_0x72c0f5.textContent=_0xd5('Q3JpYW5kbyBaSVAgY29tIA==')+_0x72c7f5.length+_0xd5('IGFycXVpdm9zLi4u');
_0x713ff5.textContent=_0xd5('RW1wYWNvdGFuZG8uLi4=');
if(typeof JSZip===_0xd5('dW5kZWZpbmVk'))throw new Error(_0xd5('SlNaaXAgbmFvIGNhcnJlZ2Fkby4gVXNlIG8gUGFpbmVsIExhdGVyYWwu'));
var _0x72c8f5=new JSZip();
var _0x72c9f5=[_0xd5('LnBuZw=='),_0xd5('LmpwZw=='),_0xd5('LmpwZWc='),_0xd5('LmdpZg=='),_0xd5('LnN2Zw=='),_0xd5('Lmljbw=='),_0xd5('LndlYnA='),_0xd5('LmJtcA=='),_0xd5('LnRpZmY=')];
var _0x72caf5=0;
for(var _0x72cbf5=0;_0x72cbf5<_0x72c7f5.length;_0x72cbf5++){
var _0x72ccf5=_0x72c7f5[_0x72cbf5];
if(!_0x72ccf5.name||_0x72ccf5.sizeExceeded)continue;
if(_0x72ccf5.contents&&_0x72ccf5.binary){_0x72c8f5.file(_0x72ccf5.name,_0x72ccf5.contents,{base64:true,binary:true});_0x72caf5++;}
else if(!_0x72ccf5.contents&&_0x72c9f5.some(function(_0x731df5){return _0x72ccf5.name.toLowerCase().endsWith(_0x731df5);})){
try{
var _0x72cdf5=await fetch(_0xd5('aHR0cHM6Ly9hcGkubG92YWJsZS5kZXYvcHJvamVjdHMv')+_0x72c4f5+_0xd5('L2ZpbGVzL3Jhdz9wYXRoPQ==')+encodeURIComponent(_0x72ccf5.name),{method:'GET',headers:{'Authorization':_0xd5('QmVhcmVyIA==')+_0x72c2f5},credentials:_0xd5('b21pdA=='),mode:_0xd5('Y29ycw==')});
if(_0x72cdf5.ok){_0x72c8f5.file(_0x72ccf5.name,await _0x72cdf5.arrayBuffer(),{binary:true});_0x72caf5++;}
else if(_0x72ccf5.contents){_0x72c8f5.file(_0x72ccf5.name,_0x72ccf5.contents);_0x72caf5++;}
}catch(_0x731ff5){if(_0x72ccf5.contents){_0x72c8f5.file(_0x72ccf5.name,_0x72ccf5.contents);_0x72caf5++;}}
}else if(_0x72ccf5.contents){_0x72c8f5.file(_0x72ccf5.name,_0x72ccf5.contents);_0x72caf5++;}
}
var _0x72cef5=await _0x72c8f5.generateAsync({type:_0xd5('YmxvYg=='),compression:_0xd5('REVGTEFURQ=='),compressionOptions:{level:9}});
var _0x72cff5=document.createElement('a');
_0x72cff5.href=URL.createObjectURL(_0x72cef5);
_0x72cff5.download=_0xd5('bG92YWJsZS0=')+_0x72c4f5.substring(0,8)+'-'+new Date().toISOString().split('T')[0]+_0xd5('LnppcA==');
document.body.appendChild(_0x72cff5);_0x72cff5.click();document.body.removeChild(_0x72cff5);URL.revokeObjectURL(_0x72cff5.href);
if(_0x72c0f5){_0x72c0f5.className=_0xd5('cWwtbG9nLXN1Y2Nlc3M=');_0x72c0f5.textContent=_0x72caf5+_0xd5('IGFycXVpdm9zIGJhaXhhZG9zIQ==');}
_0x713ff5.textContent=_0xd5('RG93bmxvYWQgQ29tcGxldG8h');
setTimeout(function(){_0x713ff5.textContent=_0xd5('QmFpeGFyIFRvZG9zIEFycXVpdm9z');_0x713ff5.disabled=false;if(_0x72c0f5)_0x72c0f5.style.display=_0xd5('bm9uZQ==');},4000);
}catch(_0x7321f5){
if(_0x72c0f5){_0x72c0f5.className=_0xd5('cWwtbG9nLWVycm9y');_0x72c0f5.textContent=(_0x7321f5.message||_0x7321f5);_0x72c0f5.style.display=_0xd5('YmxvY2s=');}
_0x713ff5.textContent=_0xd5('RmFsaG91');
setTimeout(function(){_0x713ff5.textContent=_0xd5('QmFpeGFyIFRvZG9zIEFycXVpdm9z');_0x713ff5.disabled=false;},3000);
}
});
}
async function checkForUpdatePopup(){
return;
}
async function checkResellerRolePopup(){
try{
var _0x7331f5=await new Promise(function(_0x7344f5){chrome.storage.local.get([_0xd5('cWxfbGljZW5zZV9rZXk=')],_0x7344f5);});
if(!_0x7331f5.ql_license_key)return;
var _0x7332f5=await bgFetch(_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9yZXN0L3YxL3RzX2xpY2Vuc2VzP3NlbGVjdD11c2VyX2lkJmxpY2Vuc2Vfa2V5PWVxLg==')+encodeURIComponent(_0x7331f5.ql_license_key)+_0xd5('JmxpbWl0PTE='),{method:"GET",headers:{apikey:SUPABASE_ANON_KEY}});
if(!_0x7332f5||!_0x7332f5.length||!_0x7332f5[0].user_id)return;
var _0x7333f5=_0x7332f5[0].user_id;
var _0x7334f5=await bgFetch(USER_ROLES_URL_POPUP+_0xd5('JnVzZXJfaWQ9ZXEu')+_0x7333f5,{method:"GET",headers:{apikey:SUPABASE_ANON_KEY,Authorization:_0xd5('QmVhcmVyIA==')+SUPABASE_ANON_KEY}});
if(_0x7334f5&&Array.isArray(_0x7334f5)&&_0x7334f5.some(function(_0x7353f5){return _0x7353f5.role===_0xd5('cmVzZWxsZXI=')||_0x7353f5.role===_0xd5('YWRtaW4=');})){
var _0x7335f5=document.getElementById(_0xd5('cWwtcmVzZWxsZXItYnRu'));
if(_0x7335f5)_0x7335f5.style.display=_0xd5('YmxvY2s=');
}
}catch(_0x7355f5){}
}
let qlNativeChatActive=false;
let qlNativeChatCleanup=null;
function activateNativeChat(){
qlNativeChatActive=false;
cleanupLovablePromptLocks();
}
function deactivateNativeChat(){
qlNativeChatActive=false;
chrome.storage.local.set({ql_native_chat:false});
if(qlNativeChatCleanup){qlNativeChatCleanup();qlNativeChatCleanup=null;}
const _0x7472f5=document.getElementById(_0xd5('cWwtbmF0aXZlLWJhZGdl'));
if(_0x7472f5)_0x7472f5.remove();
const _0x7473f5=document.getElementById(_0xd5('cWwtbmF0aXZlLXJldHVybi1idG4='));
if(_0x7473f5)_0x7473f5.remove();
const _0x7474f5=document.getElementById(_0xd5('Y2hhdGlucHV0LXNlbmQtbWVzc2FnZS1idXR0b24='));
if(_0x7474f5){
_0x7474f5.classList.remove(_0xd5('cWwtbmF0aXZlLXNlbmQtYWN0aXZl'));
_0x7474f5.style.animation="";
}
const _0x7475f5=document.getElementById(_0xd5('cWwtZmxvYXRpbmc='));
if(_0x7475f5){
_0x7475f5.style.display="";
_0x7475f5.style.opacity="0";
_0x7475f5.style.transform=_0xd5('c2NhbGUoMC45NSk=');
requestAnimationFrame(()=>{
_0x7475f5.style.transition=_0xd5('b3BhY2l0eSAwLjRzIGVhc2UsIHRyYW5zZm9ybSAwLjRzIGVhc2U=');
_0x7475f5.style.opacity="1";
_0x7475f5.style.transform=_0xd5('c2NhbGUoMSkgdHJhbnNsYXRlWCgwKQ==');
});
}else{
_buildFloatingUI();
}
}
function injectNativeChatOverlay(){
qlNativeChatActive=false;
cleanupLovablePromptLocks();
return;
function _0x7730f5(_0x7572f5){
if(!qlNativeChatActive)return;
if(Number(chatForm.dataset.qlNativeBypassUntil||0)>Date.now())return;
const _0x7573f5=chatForm.querySelector(_0xd5('W2NvbnRlbnRlZGl0YWJsZT0idHJ1ZSJd'));
const _0x7574f5=_0x7573f5?(_0x7573f5.innerText||_0x7573f5.textContent||"").trim():"";
if(!_0x7574f5)return;
_0x7572f5.preventDefault();
_0x7572f5.stopPropagation();
_0x7572f5.stopImmediatePropagation();
sendViaNativeChat(_0x7574f5,_0x7573f5);
}
function _0x7731f5(_0x7650f5){
if(!qlNativeChatActive)return;
if(Number(chatForm.dataset.qlNativeBypassUntil||0)>Date.now())return;
const _0x7651f5=chatForm.querySelector(_0xd5('W2NvbnRlbnRlZGl0YWJsZT0idHJ1ZSJd'));
const _0x7652f5=_0x7651f5?(_0x7651f5.innerText||_0x7651f5.textContent||"").trim():"";
if(!_0x7652f5)return;
_0x7650f5.preventDefault();
_0x7650f5.stopPropagation();
_0x7650f5.stopImmediatePropagation();
sendViaNativeChat(_0x7652f5,_0x7651f5);
}
function _0x7732f5(_0x7675f5){
if(!qlNativeChatActive)return;
if(Number(chatForm.dataset.qlNativeBypassUntil||0)>Date.now())return;
if(_0x7675f5.key===_0xd5('RW50ZXI=')&&!_0x7675f5.shiftKey){
const _0x76daf5=chatForm.querySelector(_0xd5('W2NvbnRlbnRlZGl0YWJsZT0idHJ1ZSJd'));
const _0x76dbf5=_0x76daf5?(_0x76daf5.innerText||_0x76daf5.textContent||"").trim():"";
if(!_0x76dbf5)return;
_0x7675f5.preventDefault();
_0x7675f5.stopPropagation();
_0x7675f5.stopImmediatePropagation();
sendViaNativeChat(_0x76dbf5,_0x76daf5);
}
}
if(sendBtn)sendBtn.addEventListener(_0xd5('Y2xpY2s='),_0x7730f5,true);
chatForm.addEventListener(_0xd5('c3VibWl0'),_0x7731f5,true);
chatForm.addEventListener(_0xd5('a2V5ZG93bg=='),_0x7732f5,true);
qlNativeChatCleanup=function(){
if(sendBtn)sendBtn.removeEventListener(_0xd5('Y2xpY2s='),_0x7730f5,true);
chatForm.removeEventListener(_0xd5('c3VibWl0'),_0x7731f5,true);
chatForm.removeEventListener(_0xd5('a2V5ZG93bg=='),_0x7732f5,true);
};
}
async function sendViaNativeChat(_0x777ff5,_0x7780f5){
const _0x7781f5=document.getElementById(_0xd5('Y2hhdGlucHV0LXNlbmQtbWVzc2FnZS1idXR0b24='));
showNativeSendingOverlay(true);
if(_0x7781f5){
_0x7781f5.style.animation=_0xd5('bm9uZQ==');
_0x7781f5.classList.add(_0xd5('cWwtbmF0aXZlLXNlbmRpbmc='));
_0x7781f5.disabled=true;
}
try{
var _0x7782f5=await sendPromptNativeViaBackground(_0x777ff5,false);
if(_0x7780f5){
_0x7780f5.innerHTML=_0xd5('PHA+PGJyIGNsYXNzPSJQcm9zZU1pcnJvci10cmFpbGluZ0JyZWFrIj48L3A+');
_0x7780f5.dispatchEvent(new Event(_0xd5('aW5wdXQ='),{bubbles:true}));
}
addToChatHistory(_0x777ff5,"ok");
showNativeChatToast(_0xd5('4pyTIFByb21wdCBlbnZpYWRvIGNvbSBzdWNlc3NvIQ=='),_0xd5('c3VjY2Vzcw=='));
}catch(_0x7784f5){
addToChatHistory(_0x777ff5,_0xd5('ZXJyb3I='));
showNativeChatToast("\u2717 "+(_0x7784f5.message||_0xd5('RXJybyBubyBlbnZpbw==')),_0xd5('ZXJyb3I='));
}finally{
showNativeSendingOverlay(false);
if(_0x7781f5){
_0x7781f5.classList.remove(_0xd5('cWwtbmF0aXZlLXNlbmRpbmc='));
_0x7781f5.classList.add(_0xd5('cWwtbmF0aXZlLXNlbmQtYWN0aXZl'));
_0x7781f5.disabled=false;
_0x7781f5.style.animation="";
requestAnimationFrame(()=>{
_0x7781f5.style.animation=_0xd5('cWwtc2VuZC1ibGluayAxLjVzIGluZmluaXRl');
});
}
}
}
function showNativeSendingOverlay(_0x7861f5){
const _0x7862f5=_0xd5('cWwtbmF0aXZlLXNlbmRpbmctb3ZlcmxheQ==');
const _0x7863f5=document.getElementById(_0x7862f5);
if(!_0x7861f5){if(_0x7863f5)_0x7863f5.remove();return;}
if(_0x7863f5)return;
const _0x7864f5=document.createElement("div");
_0x7864f5.id=_0x7862f5;
_0x7864f5.className=_0xd5('cWwtbmF0aXZlLXNlbmRpbmctb3ZlcmxheQ==');
_0x7864f5.innerHTML=_0xd5('PGRpdiBjbGFzcz0icWwtc3Bpbm5lciI+PC9kaXY+IEVudmlhbmRvIHByb21wdC4uLg==');
document.body.appendChild(_0x7864f5);
}
function showNativeChatToast(_0x795df5,_0x795ef5){
const _0x795ff5=document.getElementById(_0xd5('cWwtbmF0aXZlLXRvYXN0'));
if(_0x795ff5)_0x795ff5.remove();
const _0x7960f5=document.createElement("div");
_0x7960f5.id=_0xd5('cWwtbmF0aXZlLXRvYXN0');
_0x7960f5.className=_0xd5('cWwtbmF0aXZlLXRvYXN0IHFsLW5hdGl2ZS10b2FzdC0=')+_0x795ef5;
_0x7960f5.textContent=_0x795df5;
document.body.appendChild(_0x7960f5);
requestAnimationFrame(()=>_0x7960f5.classList.add(_0xd5('cWwtbmF0aXZlLXRvYXN0LXZpc2libGU=')));
setTimeout(()=>{
_0x7960f5.classList.remove(_0xd5('cWwtbmF0aXZlLXRvYXN0LXZpc2libGU='));
setTimeout(()=>_0x7960f5.remove(),300);
},3000);
}
function setupNativeChatButton(){
const _0x7975f5=document.getElementById(_0xd5('cWwtbmF0aXZlLWNoYXQtYnRu'));
if(_0x7975f5)_0x7975f5.remove();
cleanupLovablePromptLocks();
}
cleanupLovablePromptLocks();
window.addEventListener(_0xd5('bWVzc2FnZQ=='),(_0x7b79f5)=>{
if(_0x7b79f5.source!==window)return;
if(!_0x7b79f5.data||_0x7b79f5.data.type!==_0xd5('bG92YWJsZVRva2VuRm91bmQ='))return;
const _0x7b7af5=location.pathname.match(/projects\/([0-9a-fA-F-]{36})/i);
const _0x7b7bf5=_0x7b7af5?_0x7b7af5[1]:null;
const _0x7b7cf5=String(_0x7b79f5.data.token||"").replace(/^Bearer\s+/i,"").trim();
const _0x7b7df5=_0x7b79f5.data.projectId||_0x7b7bf5;
if(_0x7b7cf5){
chrome.storage.local.set({lovable_token_global:_0x7b7cf5});
}
if(!_0x7b7bf5||!_0x7b7cf5||!_0x7b7df5||_0x7b7df5!==_0x7b7bf5){
chrome.storage.local.remove([_0xd5('bG92YWJsZV90b2tlbg=='),_0xd5('bG92YWJsZV9wcm9qZWN0SWQ=')]);
return;
}
chrome.storage.local.set({
lovable_token:_0x7b7cf5,
lovable_projectId:_0x7b7df5
});
});
function setupCreateProject(){
var _0x7b92f5=document.getElementById(_0xd5('cWwtY3JlYXRlLXByb2plY3Q='));
if(!_0x7b92f5)return;
_0x7b92f5.addEventListener(_0xd5('Y2xpY2s='),async function(){
var _0x7c29f5=document.getElementById(_0xd5('cWwtZG93bmxvYWQtc3RhdHVz'));
var _0x7c2af5=_0x7b92f5.textContent;
_0x7b92f5.disabled=true;
_0x7b92f5.textContent=_0xd5('Q3JpYW5kbyBwcm9qZXRvLi4u');
if(_0x7c29f5){_0x7c29f5.style.display=_0xd5('YmxvY2s=');_0x7c29f5.className=_0xd5('cWwtbG9nLWluZm8=');_0x7c29f5.textContent=_0xd5('UHJlcGFyYW5kbyBjcmlhw6fDo28uLi4=');}
try{
var _0x7c2bf5=await new Promise(function(_0x7c3ef5){chrome.storage.local.get([_0xd5('bG92YWJsZV90b2tlbg=='),_0xd5('bG92YWJsZV90b2tlbl9nbG9iYWw='),_0xd5('bG92YWJsZUJlYXJlclRva2Vu')],_0x7c3ef5);});
var _0x7c2cf5=_0x7c2bf5.lovableBearerToken||_0x7c2bf5.lovable_token_global||_0x7c2bf5.lovable_token||'';
if(_0x7c2cf5.indexOf(_0xd5('QmVhcmVyIA=='))===0)_0x7c2cf5=_0x7c2cf5.slice(7);
if(!_0x7c2cf5){
try{window.postMessage({type:_0xd5('bG92YWJsZVJlcXVlc3RUb2tlbg==')},'*');}catch(_0x7c40f5){}
await new Promise(function(_0x7c48f5){setTimeout(_0x7c48f5,600);});
_0x7c2bf5=await new Promise(function(_0x7c59f5){chrome.storage.local.get([_0xd5('bG92YWJsZV90b2tlbg=='),_0xd5('bG92YWJsZV90b2tlbl9nbG9iYWw='),_0xd5('bG92YWJsZUJlYXJlclRva2Vu')],_0x7c59f5);});
_0x7c2cf5=(_0x7c2bf5.lovableBearerToken||_0x7c2bf5.lovable_token_global||_0x7c2bf5.lovable_token||'').replace(/^Bearer\s+/i,'');
}
if(_0x7c29f5)_0x7c29f5.textContent=_0xd5('Q3JpYW5kbyBwcm9qZXRvIG5vIExvdmFibGUuLi4=');
var _0x7c2df5=await new Promise(function(_0x7c6df5){
chrome.runtime.sendMessage({action:_0xd5('Y3JlYXRlTG92YWJsZVByb2plY3RJblBhZ2U='),token:_0x7c2cf5,title:''},function(_0x7c7cf5){
_0x7c6df5(_0x7c7cf5||{ok:false,error:_0xd5('c2VtIHJlc3Bvc3Rh')});
});
});
if(!_0x7c2df5||(!_0x7c2df5.success&&!_0x7c2df5.ok)||!_0x7c2df5.link){
throw new Error((_0x7c2df5&&(_0x7c2df5.error_display||_0x7c2df5.error))||_0xd5('RmFsaGEgYW8gY3JpYXIgcHJvamV0bw=='));
}
if(_0x7c29f5){_0x7c29f5.className=_0xd5('cWwtbG9nLXN1Y2Nlc3M=');_0x7c29f5.textContent=_0xd5('UHJvamV0byBjcmlhZG8hIFJlZGlyZWNpb25hbmRvLi4u');}
_0x7b92f5.textContent=_0xd5('U3VjZXNzbyE=');
setTimeout(function(){
try{window.location.href=_0x7c2df5.link;}
catch(_0x7c7ef5){window.open(_0x7c2df5.link,_0xd5('X2JsYW5r'));}
},400);
}catch(_0x7c80f5){
console.error(_0xd5('W0NyZWF0ZVByb2plY3Rd'),_0x7c80f5);
if(_0x7c29f5){_0x7c29f5.className=_0xd5('cWwtbG9nLWVycm9y');_0x7c29f5.textContent=''+(_0x7c80f5.message||_0xd5('RXJybw=='));}
_0x7b92f5.disabled=false;
_0x7b92f5.textContent=_0x7c2af5;
}
});
}
(function _0x7c9cf5(){
try{
window.__TS_DONE_SOUND_ENABLED__=true;
try{
chrome.storage.local.get([_0xd5('c291bmROb3RpZmljYXRpb25zRW5hYmxlZA=='),_0xd5('bm90aWZ5V2hlbkRvbmVFbmFibGVk')],function(_0x7cf1f5){
if(_0x7cf1f5&&typeof _0x7cf1f5.soundNotificationsEnabled!==_0xd5('dW5kZWZpbmVk')){
window.__TS_DONE_SOUND_ENABLED__=_0x7cf1f5.soundNotificationsEnabled!==false;
}else if(_0x7cf1f5&&typeof _0x7cf1f5.notifyWhenDoneEnabled!==_0xd5('dW5kZWZpbmVk')){
window.__TS_DONE_SOUND_ENABLED__=_0x7cf1f5.notifyWhenDoneEnabled!==false;
}else{
window.__TS_DONE_SOUND_ENABLED__=true;
}
});
chrome.storage.onChanged.addListener(function(_0x7d0cf5,_0x7d0df5){
if(_0x7d0df5===_0xd5('bG9jYWw=')&&_0x7d0cf5&&_0x7d0cf5.soundNotificationsEnabled){
window.__TS_DONE_SOUND_ENABLED__=_0x7d0cf5.soundNotificationsEnabled.newValue!==false;
}
});
}catch(_0x7d0ff5){}
function _0x7fcef5(){return window.__TS_DONE_SOUND_ENABLED__!==false;}
window.__TS_isSoundEnabled=_0x7fcef5;
var _0x7c9df5=[
_0xd5('d29ya2luZw=='),_0xd5('YXBwbHlpbmc='),_0xd5('ZWRpdGluZw=='),_0xd5('Z2VuZXJhdGluZw=='),_0xd5('dGhpbmtpbmc='),
_0xd5('YW5hbHl6aW5n'),_0xd5('YnVpbGRpbmc='),_0xd5('Y3JlYXRpbmc='),_0xd5('cmV2aWV3aW5n'),_0xd5('c3RhcnRpbmc='),
_0xd5('dXBkYXRpbmc='),_0xd5('cnVubmluZw==')
];
function _0x7fcff5(){
try{
var _0x7dc5f5=document.querySelector(_0xd5('W2NsYXNzKj0iY2hhdCJdLCBtYWluLCBib2R5'));
var _0x7dc6f5=(_0x7dc5f5?_0x7dc5f5.innerText:document.body.innerText||"").toLowerCase();
var _0x7dc7f5=false;
for(var _0x7dc8f5=0;_0x7dc8f5<_0x7c9df5.length;_0x7dc8f5++){
if(_0x7dc6f5.indexOf(_0x7c9df5[_0x7dc8f5]+"...")!==-1||
_0x7dc6f5.indexOf(_0x7c9df5[_0x7dc8f5]+"…")!==-1){
_0x7dc7f5=true;break;
}
}
if(!_0x7dc7f5){
var _0x7dc9f5=document.querySelectorAll(_0xd5('YnV0dG9u'));
for(var _0x7dcaf5=0;_0x7dcaf5<_0x7dc9f5.length;_0x7dcaf5++){
var _0x7dcbf5=_0x7dc9f5[_0x7dcaf5];
var _0x7dccf5=(_0x7dcbf5.innerText||"").trim().toLowerCase();
var _0x7dcdf5=(_0x7dcbf5.getAttribute(_0xd5('YXJpYS1sYWJlbA=='))||"").toLowerCase();
if(_0x7dccf5===_0xd5('c3RvcA==')||_0x7dccf5===_0xd5('Y2FuY2Vs')||_0x7dcdf5.indexOf(_0xd5('c3RvcA=='))!==-1){
return true;
}
}
}
return _0x7dc7f5;
}catch(_0x7dcff5){return false;}
}
var _0x7c9ef5=false;
var _0x7c9ff5=null;
var _0x7ca0f5=0;
var _0x7ca1f5=0;
var _0x7ca2f5={
send:_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9zdG9yYWdlL3YxL29iamVjdC9wdWJsaWMvc291bmRzL3NlbmQubXAz'),
done:_0xd5('aHR0cHM6Ly9oeWpzYWlhbGVicHNrd2Z2aW5pZy5zdXBhYmFzZS5jby9zdG9yYWdlL3YxL29iamVjdC9wdWJsaWMvc291bmRzL2RvbmUubXAz')
};
function _0x7fd0f5(_0x7e9ff5,_0x7ea0f5){
try{
var _0x7ea1f5=_0x7ca2f5[_0x7e9ff5];
if(!_0x7ea1f5)return;
var _0x7ea2f5=new Audio(_0x7ea1f5);
_0x7ea2f5.volume=(typeof _0x7ea0f5===_0xd5('bnVtYmVy'))?_0x7ea0f5:0.8;
var _0x7ea3f5=_0x7ea2f5.play();
if(_0x7ea3f5&&_0x7ea3f5.catch)_0x7ea3f5.catch(function(_0x7eadf5){
console.warn(_0xd5('W29mZXJyb2xnYXJjaWFdIEZhbGhhIGFvIHJlcHJvZHV6aXIgc29tOg=='),_0x7eadf5);
});
}catch(_0x7eaff5){
console.warn(_0xd5('W29mZXJyb2xnYXJjaWFdIEZhbGhhIGFvIHJlcHJvZHV6aXIgc29tOg=='),_0x7eaff5);
}
}
function _0x7fd1f5(){
if(!_0x7fcef5())return;
var _0x7ecef5=Date.now();
if(_0x7ecef5-_0x7ca0f5<8000)return;
_0x7ca0f5=_0x7ecef5;
_0x7fd0f5(_0xd5('ZG9uZQ=='),0.8);
}
function _0x7fd2f5(){
if(!_0x7fcef5())return;
var _0x7eedf5=Date.now();
if(_0x7eedf5-_0x7ca1f5<1000)return;
_0x7ca1f5=_0x7eedf5;
_0x7fd0f5(_0xd5('c2VuZA=='),0.8);
}
window.__TS_playPromptSentSound=_0x7fd2f5;
try{
chrome.runtime.onMessage.addListener(function(_0x7f2cf5){
if(_0x7f2cf5&&_0x7f2cf5.action===_0xd5('dHNQbGF5UHJvbXB0U2VudFNvdW5k'))_0x7fd2f5();
});
}catch(_0x7f2ef5){}
window.addEventListener(_0xd5('bWVzc2FnZQ=='),function(_0x7f6cf5){
if(_0x7f6cf5&&_0x7f6cf5.data&&_0x7f6cf5.data.type===_0xd5('dHNQbGF5UHJvbXB0U2VudFNvdW5k'))_0x7fd2f5();
});
function _0x7fd3f5(){
if(!_0x7fcef5())return;
var _0x7f80f5=_0x7fcff5();
if(_0x7f80f5){
_0x7c9ef5=true;
if(_0x7c9ff5){clearTimeout(_0x7c9ff5);_0x7c9ff5=null;}
return;
}
if(_0x7c9ef5&&!_0x7f80f5){
if(_0x7c9ff5)clearTimeout(_0x7c9ff5);
_0x7c9ff5=setTimeout(function(){
if(!_0x7fcff5()){
_0x7fd1f5();
_0x7c9ef5=false;
}
_0x7c9ff5=null;
},2500);
}
}
var _0x7ca3f5=false;
var _0x7ca4f5=new MutationObserver(function(){
if(_0x7ca3f5)return;
_0x7ca3f5=true;
setTimeout(function(){_0x7ca3f5=false;_0x7fd3f5();},400);
});
function _0x7fd4f5(){
if(!document.body){setTimeout(_0x7fd4f5,200);return;}
_0x7ca4f5.observe(document.body,{childList:true,subtree:true,characterData:true});
console.info(_0xd5('W1RTIEV4dGVuc2lvbl0gTG92YWJsZSBkb25lIG9ic2VydmVyIHN0YXJ0ZWQ='));
}
_0x7fd4f5();
}catch(_0x7fd6f5){
console.warn(_0xd5('W1RTIEV4dGVuc2lvbl0gbG92YWJsZURvbmVTb3VuZEZlYXR1cmUgZmFpbGVk'),_0x7fd6f5);
}
})();
