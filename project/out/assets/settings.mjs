import {escapeHtml as e} from './api.mjs';
import {accessForRole} from './access-permissions.mjs';
export async function render(root) {
  const access = accessForRole(document.body.dataset.accessRole);
  root.innerHTML = `<header class="page-head"><h1>Settings</h1><p>บัญชีและการเข้าใช้งาน</p></header>
    <section class="account-settings" aria-labelledby="account-heading">
      <div class="account-settings-heading"><span class="account-eyebrow">ACCOUNT</span><h2 id="account-heading">บัญชีของคุณ</h2></div>
      <div class="account-settings-row"><div><h3>${e(document.body.dataset.accessUserName||access.label)}</h3><p>${e([document.body.dataset.accessPosition||access.label,document.body.dataset.accessTeam].filter(Boolean).join(' · '))} · ${access.caption}</p></div><a class="btn btn-quiet" href="/login?next=%2Fsettings">เปลี่ยนสิทธิ์</a></div>
      <div class="account-settings-row account-signout"><div><h3>ออกจากระบบ</h3><p>สิ้นสุดการใช้งานบัญชีบนเบราว์เซอร์นี้</p></div><form method="post" action="/logout" data-session-form><button type="submit" class="account-signout-button">ออกจากระบบ</button></form></div>
    </section>`;
}
