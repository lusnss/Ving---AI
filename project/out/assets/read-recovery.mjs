// Last successful reads stay in this page's memory, never in shared browser storage.
export function createRecoverableRead({fetchImpl=(...args)=>fetch(...args),now=Date.now,timeoutMs=12000}={}){
 const saved=new Map(),pending=new Map(),generations=new Map();
 function read(url,{fallback=false,validate=()=>true}={}){
  if(pending.has(url))return pending.get(url);
  const controller=new AbortController(),generation=generations.get(url)||0;let timer;
  const request=(async()=>{
   try{
    const value=await Promise.race([
     (async()=>{const response=await fetchImpl(url,{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw Object.assign(Error(response.status===401?'กรุณาเข้าสู่ระบบอีกครั้ง':response.status===403?'ไม่มีสิทธิ์เปิดข้อมูลนี้':'ยังอัปเดตข้อมูลไม่ได้ กรุณาลองใหม่'),{status:response.status});
      const data=await response.json();if(!validate(data))throw Error('ข้อมูลยังไม่พร้อม กรุณาลองใหม่');return data;})(),
     new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('โหลดข้อมูลเกินเวลาที่กำหนด กรุณาลองใหม่'),{name:'TimeoutError'}));},timeoutMs);})
    ]);
    if(generation!==(generations.get(url)||0))throw Object.assign(Error('ข้อมูลเปลี่ยนแล้ว กรุณาลองใหม่'),{invalidated:true});
    if(fallback)saved.set(url,{value:structuredClone(value),at:new Date(now()).toISOString()});
    return value;
   }catch(error){
    if(error.status===401||error.status===403){saved.clear();throw error;}
    if(error.invalidated)throw error;
    const previous=saved.get(url);
    if(!fallback||!previous)throw error;
    const value=structuredClone(previous.value);
    return {...value,recovery:{stale:true,lastSuccessAt:previous.at},...(value.permissions?{permissions:{...value.permissions,canEdit:false,canApprove:false}}:{})};
   }finally{clearTimeout(timer);if(pending.get(url)===request)pending.delete(url);}
  })();
  pending.set(url,request);return request;
 };
 read.invalidate=url=>{saved.delete(url);generations.set(url,(generations.get(url)||0)+1);pending.delete(url);};
 return read;
}
export const recoverableRead=createRecoverableRead();
