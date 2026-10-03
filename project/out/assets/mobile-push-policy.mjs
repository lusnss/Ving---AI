// The mandatory enrollment flow is limited to iPhone Home Screen web apps.
export function requiresIPhonePush({userAgent,standalone,displayStandalone}){
 return /iPhone/.test(userAgent||'')&&(standalone===true||displayStandalone===true);
}
export function isIPhoneHomeScreen(){
 return requiresIPhonePush({userAgent:navigator.userAgent,standalone:navigator.standalone,displayStandalone:matchMedia('(display-mode: standalone)').matches});
}
