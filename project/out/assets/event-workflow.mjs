export const workflowLabels={pending:'รออนุมัติ',rejected:'ไม่อนุมัติ',scheduled:'รอจัดงาน',completed:'จัดแล้ว',cancelled:'ยกเลิก'};
export const fullyApproved=row=>row.trade==='อนุมัติ'&&row.ceo==='อนุมัติ';
export function eventWorkflowStatus(row){
 if(row.workflow?.status==='cancelled')return 'cancelled';
 if(row.workflow?.status==='completed')return 'completed';
 if(row.trade==='ไม่อนุมัติ'||row.ceo==='ไม่อนุมัติ')return 'rejected';
 return fullyApproved(row)?'scheduled':'pending';
}
