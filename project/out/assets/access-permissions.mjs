const accessRoles = Object.freeze({
  admin: Object.freeze({label:'Trade Manager',caption:'จัดการทุกส่วนและอนุมัติงาน',monogram:'',canEdit:true,canApprove:true}),
  assistant: Object.freeze({label:'Assistant Trade Manager',caption:'แก้ไขทุกส่วน · ไม่มีสิทธิ์อนุมัติงาน',monogram:'AT',canEdit:true,canApprove:false}),
  viewer: Object.freeze({label:'บุคคลทั่วไป',caption:'ดูอย่างเดียว',monogram:'V',canEdit:false,canApprove:false})
});

export function accessForRole(role) {
  return Object.hasOwn(accessRoles,role) ? accessRoles[role] : accessRoles.viewer;
}
