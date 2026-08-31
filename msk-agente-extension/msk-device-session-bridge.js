// MSK Device Session Bridge v1.
const MSK_DEVICE_BRIDGE_ORIGIN = 'https://msksystem.online';
const MSK_DEVICE_BRIDGE_DB = 'msk-security-v1';
const MSK_DEVICE_BRIDGE_STORE = 'device-keys';
const MSK_DEVICE_BRIDGE_RECORD = 'primary';
const MSK_DEVICE_BRIDGE_SESSION_KEY = 'mskSecuritySessionV1';
const MSK_DEVICE_BRIDGE_FILES = ['background.js','chatgpt-bridge.js','grok-bridge.js','content.js','msk-license.js','msk-license-resilient.js'];
let mskDeviceBridgeFingerprintPromise = null;
function mskDeviceBridgeHex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');}
async function mskDeviceBridgeSha(bytes){return new Uint8Array(await crypto.subtle.digest('SHA-256',bytes));}
async function mskDeviceBridgeFingerprint(){
  if(mskDeviceBridgeFingerprintPromise)return mskDeviceBridgeFingerprintPromise;
  mskDeviceBridgeFingerprintPromise=(async()=>{const rows=[];for(const file of MSK_DEVICE_BRIDGE_FILES){const response=await fetch(chrome.runtime.getURL(file),{cache:'no-store'});if(!response.ok)throw new Error('MSK_SECURITY_FILE_MISSING');rows.push(`${file}:${mskDeviceBridgeHex(await mskDeviceBridgeSha(new Uint8Array(await response.arrayBuffer())))}`);}return mskDeviceBridgeHex(await mskDeviceBridgeSha(new TextEncoder().encode(rows.join('\n'))));})().catch(error=>{mskDeviceBridgeFingerprintPromise=null;throw error;});
  return mskDeviceBridgeFingerprintPromise;
}
function mskDeviceBridgeOpenDb(){return new Promise((resolve,reject)=>{const request=indexedDB.open(MSK_DEVICE_BRIDGE_DB,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(MSK_DEVICE_BRIDGE_STORE))db.createObjectStore(MSK_DEVICE_BRIDGE_STORE);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('MSK_DEVICE_DB'));});}
async function mskDeviceBridgeGetRecord(){const db=await mskDeviceBridgeOpenDb();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(MSK_DEVICE_BRIDGE_STORE,'readonly');const req=tx.objectStore(MSK_DEVICE_BRIDGE_STORE).get(MSK_DEVICE_BRIDGE_RECORD);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error('MSK_DEVICE_GET'));});}finally{db.close();}}
async function mskDeviceBridgePutRecord(record){const db=await mskDeviceBridgeOpenDb();try{await new Promise((resolve,reject)=>{const tx=db.transaction(MSK_DEVICE_BRIDGE_STORE,'readwrite');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('MSK_DEVICE_PUT'));tx.objectStore(MSK_DEVICE_BRIDGE_STORE).put(record,MSK_DEVICE_BRIDGE_RECORD);});}finally{db.close();}}
async function mskDeviceBridgeIdentity(){const existing=await mskDeviceBridgeGetRecord().catch(()=>null);if(existing?.privateKey&&existing?.publicJwk)return existing;const generated=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);const privateJwk=await crypto.subtle.exportKey('jwk',generated.privateKey);const publicJwk=await crypto.subtle.exportKey('jwk',generated.publicKey);const privateKey=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);const record={privateKey,publicJwk,createdAt:Date.now()};await mskDeviceBridgePutRecord(record);return record;}
async function mskDeviceBridgeCachedSession(identity,fingerprint){try{const session=(await chrome.storage.session.get(MSK_DEVICE_BRIDGE_SESSION_KEY))[MSK_DEVICE_BRIDGE_SESSION_KEY];if(session?.token&&Number(session.expiresAt||0)>Date.now()+30000&&session.installationId===identity.installationId&&session.extensionId===identity.extensionId&&session.version===identity.version&&session.fingerprint===fingerprint)return session;}catch{}return null;}
async function mskDeviceBridgeCreateSession(identity,fingerprint){
  const device=await mskDeviceBridgeIdentity();
  const response=await fetch(`${MSK_DEVICE_BRIDGE_ORIGIN}/api/extension/session`,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Authorization:identity.authorization,'X-MSK-Installation-Id':identity.installationId,'X-MSK-Extension-Version':identity.version,'X-MSK-Extension-Id':identity.extensionId},body:JSON.stringify({public_key_jwk:device.publicJwk,build_fingerprint:fingerprint}),cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data?.session_token||!data?.session_jti){const code=String(data?.code||'SECURITY_SESSION_REQUIRED');if(['INSTALLATION_BLOCKED','BUILD_NOT_APPROVED','DEVICE_KEY_MISMATCH','BUILD_FINGERPRINT_MISMATCH','EXTENSION_ID_MISMATCH','SECURITY_ENROLLMENT_REJECTED'].includes(code)){try{await globalThis.__MSK_CLONE_GUARD_LOCK__?.({source:code==='INSTALLATION_BLOCKED'?'remote':'security',code,reason:data?.message||data?.error||'Instalação bloqueada pela segurança MSK.'});}catch{}}return{ok:false,code};}
  const session={token:String(data.session_token),jti:String(data.session_jti),expiresAt:Date.parse(data.expires_at||'')||Date.now()+8*60000,installationId:identity.installationId,extensionId:identity.extensionId,version:identity.version,fingerprint};
  try{await chrome.storage.session.set({[MSK_DEVICE_BRIDGE_SESSION_KEY]:session});}catch{}return{ok:true,session};
}
globalThis.__MSK_SECURITY_DEVICE_SESSION__=async function mskSecurityDeviceSession(input={}){
  const identity={authorization:String(input.authorization||'').trim(),installationId:String(input.installationId||'').trim(),version:String(chrome.runtime.getManifest().version||'').trim(),extensionId:String(chrome.runtime.id||'').trim()};
  if(!identity.authorization||!identity.installationId||!identity.version||!identity.extensionId)return{ok:false,code:'SECURITY_IDENTITY_REQUIRED'};
  try{const fingerprint=await mskDeviceBridgeFingerprint();const cached=await mskDeviceBridgeCachedSession(identity,fingerprint);const secured=cached?{ok:true,session:cached}:await mskDeviceBridgeCreateSession(identity,fingerprint);if(!secured.ok||!secured.session?.token)return secured;return{ok:true,token:secured.session.token,fingerprint,installationId:identity.installationId,extensionId:identity.extensionId,version:identity.version,expiresAt:secured.session.expiresAt};}catch{return{ok:false,code:'MSK_SECURITY_UNAVAILABLE'};}
};
