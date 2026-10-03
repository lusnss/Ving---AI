export const eventFloors=['G','1','2','3','4','5','Hall'];
export const eventTypes=['CDS','RBS','Sports Mall','Sport World','Organize'];
export const proposalScenarios=[{id:'downside',label:'ต่ำกว่าคาดการณ์'},{id:'base',label:'ตามคาดการณ์'},{id:'upside',label:'สูงกว่าคาดการณ์'}];
export const proposalScenarioIndex=value=>proposalScenarios.findIndex(s=>s.id===(value||'base'));
export function pcShiftHours(start,end){
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end||''))return null;
 const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
 const duration=(minutes(end)-minutes(start)+1440)%1440;
 return duration>0?duration/60:null;
}
export const validEventMonth=value=>/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&Number(value.slice(0,4))>=1900&&Number(value.slice(0,4))<=9999;
export function eventMonthLabel(value){
 return validEventMonth(value)?new Intl.DateTimeFormat('th-TH',{month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(value+'-01T00:00:00Z')):value||'—';
}
