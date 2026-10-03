// RFC 8291 (aes128gcm) and RFC 8292 (VAPID), using Workers' Web Crypto.
const pushEncoder = new TextEncoder();
export const pushBase64 = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
export function pushBytes(value) {
 if(typeof value!=='string'||!value||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('Invalid push key');
 return Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4)),c=>c.charCodeAt(0));
}
function pushJoin(...parts) {const result=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;}
async function pushHkdf(key,salt,info,length) {
 const material=await crypto.subtle.importKey('raw',key,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},material,length*8));
}
export function pushEndpoint(value) {
 const url=new URL(value);
 // Never turn a user-supplied subscription into an arbitrary server fetch.
 const allowed=url.hostname==='web.push.apple.com'||url.hostname.endsWith('.push.apple.com')||url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com';
 if(!allowed||url.protocol!=='https:'||url.port||url.username||url.password||url.hash||value.length>2048)throw Error('Invalid push endpoint');
 return url;
}
export async function encryptPush(subscription,payload,{keyPair,salt}={}) {
 const receiver=pushBytes(subscription.keys.p256dh),auth=pushBytes(subscription.keys.auth);
 if(receiver.length!==65||receiver[0]!==4||auth.length!==16)throw Error('Invalid push subscription');
 const peer=await crypto.subtle.importKey('raw',receiver,{name:'ECDH',namedCurve:'P-256'},false,[]);
 const pair=keyPair||await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
 const sender=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:peer},pair.privateKey,256));
 const ikm=await pushHkdf(shared,auth,pushJoin(pushEncoder.encode('WebPush: info\0'),receiver,sender),32);
 salt=salt||crypto.getRandomValues(new Uint8Array(16));
 const cek=await pushHkdf(ikm,salt,pushEncoder.encode('Content-Encoding: aes128gcm\0'),16);
 const nonce=await pushHkdf(ikm,salt,pushEncoder.encode('Content-Encoding: nonce\0'),12);
 const plain=typeof payload==='string'?pushEncoder.encode(payload):payload;
 if(plain.length>3900)throw Error('Push message too large');
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']),pushJoin(plain,new Uint8Array([2]))));
 const header=new Uint8Array(21);header.set(salt);new DataView(header.buffer).setUint32(16,4096);header[20]=65;
 return pushJoin(header,sender,cipher);
}
export async function pushAuthorization(endpoint,env) {
 const key=JSON.parse(env.WEB_PUSH_PRIVATE_JWK);
 const token=pushBase64(pushEncoder.encode(JSON.stringify({typ:'JWT',alg:'ES256'})))+'.'+pushBase64(pushEncoder.encode(JSON.stringify({aud:pushEndpoint(endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:env.WEB_PUSH_SUBJECT})));
 const imported=await crypto.subtle.importKey('jwk',key,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},imported,pushEncoder.encode(token)));
 return `vapid t=${token}.${pushBase64(signature)}, k=${env.WEB_PUSH_PUBLIC_KEY}`;
}
export async function sendWebPush(subscription,payload,env,send=fetch) {
 pushEndpoint(subscription.endpoint);
 const [authorization,body]=await Promise.all([pushAuthorization(subscription.endpoint,env),encryptPush(subscription,JSON.stringify(payload))]);
 const response=await send(subscription.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(6000),headers:{authorization,'content-encoding':'aes128gcm','content-type':'application/octet-stream',TTL:'3600',Urgency:'normal'},body});
 return response.status;
}
