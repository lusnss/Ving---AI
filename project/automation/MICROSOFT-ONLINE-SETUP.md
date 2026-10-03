# Direct Excel connection — one-time Microsoft setup

Status: website implementation is ready. It is **not connected** until the
Microsoft application below is registered, its runtime settings are installed,
and an administrator completes consent and verifies a successful real import.
Do not label mock tests or a website publication as a successful source sync.

The website reads sales cells through Microsoft Graph, checks for changes every
60 seconds while an authenticated browser is open, and updates the page on its
existing 15-second refresh. It reads the original workbook, including historical
months in that workbook, so same-day corrections and reduced amounts also replace
previous values. It does not download XLSX/CSV files or depend on a running Mac.
With no browser open, it reads the latest values when a viewer next opens the site.

## Microsoft 365 administrator

1. In Microsoft Entra **App registrations**, register `VING Sales Report` for
   this organization's directory only. Add a **Web** redirect URI exactly:
   `https://ving-warroom-view.cloudy-spoon-1359.chatgpt.site/api/sales-online/callback`
2. Add Microsoft Graph **delegated** permission `Files.ReadWrite` and
   `offline_access`. Microsoft requires `Files.ReadWrite` even for the Excel
   read APIs; this integration only sends GET requests to workbook endpoints.
   Do not use application permissions (unsupported by these Excel APIs), grant
   tenant-wide file access, enable a public client, or make the workbook public.
   Apply organization consent rules. The connected work account must already be
   allowed to open the original `Sales Report 2026 PC VING.xlsx` workbook.
3. Create a client secret. Install these **Sites runtime** values through the
   approved secret-management surface, never in a chat, source file or screenshot:
   - `MS_SALES_TENANT_ID`: Directory (tenant) ID
   - `MS_SALES_CLIENT_ID`: Application (client) ID
   - `MS_SALES_CLIENT_SECRET`: secret **value**, stored as a secret
4. Sign in to the VING site with the administrator role, open `/sales-online`,
   and select **เชื่อมต่อ Microsoft**. Complete Microsoft sign-in and consent.
5. Open `/daily-sales`. Confirm **Excel ออนไลน์ · ตรวจยอดทุก 1 นาที**, a fresh
   source-read timestamp, and totals/report dates matching the live workbook.
   Verify an actual authorized source correction appears without reloading the
   page; do not change business numbers merely to test the connector.

Registering the app does not start a paid Power Automate plan. Directory policy
may require administrator approval. Access can be revoked by Microsoft policy;
reconnect from `/sales-online` when prompted. Renew the client secret before its
expiry. The former Mac import remains available as a fallback; pause its existing
automation only after the live connection above has passed verification.

## Operational behavior

- OAuth uses PKCE, a ten-minute one-use state, an HttpOnly/Secure/Lax callback
  cookie, and an existing authenticated administrator-only start route.
- Tokens remain server-side, AES-GCM encrypted in R2 with an HKDF key derived
  from the existing session secret. They never enter HTML, logs or snapshots.
- Requests read only the fixed source workbook. Persisted reports contain only
  sales allow-listed fields; staff/contact data and raw cell ranges are discarded.
- Refreshes share an R2 lease across Worker instances. Concurrent reconnects
  cannot publish a result from a replaced connection.
- Source errors, changed layouts, duplicate months and missing previously read
  months keep the last good report and its original successful-read timestamp.
- The source workbook is unchanged. Prior-year months imported from other
  workbooks stay intact. A month intentionally removed/renamed in Excel requires
  review instead of silently deleting financial history on the website.
- No external access or recurring cloud scheduler has been activated by these
  files alone. Pulls run in Worker background tasks when viewers open the site.

Official references:
- [Read Excel used ranges](https://learn.microsoft.com/en-us/graph/api/worksheet-usedrange?view=graph-rest-1.0)
- [Access a shared workbook](https://learn.microsoft.com/en-us/graph/api/shares-get?view=graph-rest-1.0)
- [Authorization code flow with PKCE](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow)
