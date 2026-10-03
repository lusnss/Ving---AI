# Sales Report — cloud sync at 18:00 Asia/Bangkok

Status (17 September 2026): receiver, secret and Office Script are configured.
Excel Online -> sales-only endpoint -> live website was verified through 16 September.
The Microsoft account lacks Premium HTTP, so the Power Automate cloud flow is NOT
active. Use the existing Mac-based schedule and [online runbook](ONLINE-RUNBOOK.md)
without downloading the workbook. The instructions below describe a future cloud
flow only if an already licensed account becomes available.

## Source

Use the existing `Sales Report 2026 PC VING.xlsx` workbook from the original source
document in this workspace. Do not change its sharing settings. Do not request the
source link again. Access must use a Microsoft account that can open the workbook.
The script only returns branch names, branch codes, channel, targets, MTD and daily
amounts. Staff/contact columns and workbook URLs are never returned.

## Microsoft setup

1. Sign into Power Automate with the workbook's work account. Check that its
   Microsoft 365 license supports Office Scripts and that HTTP actions are allowed
   by the license and tenant data policies. Do not activate a paid trial or accept
   additional terms without the user's approval.
2. Save `export-sales-report.ts` as an Office Script. Connect Excel Online (Business)
   to the existing workbook. This connector requires edit access even when the
   script only reads values. Do not broaden access silently.
3. Create a Scheduled cloud flow: frequency Day, interval 1, time zone
   `SE Asia Standard Time`, hour 18, minute 0. Set trigger concurrency to 1.
4. Run script with reportPeriod:
   `formatDateTime(addDays(convertTimeZone(utcNow(),'UTC','SE Asia Standard Time'),-1),'yyyy-MM')`
   This includes the prior month on the 1st. Otherwise it uses the current month.
5. HTTP PUT to the existing site's `/api/sync/daily-sales`, Content-Type
   `application/json`, body the Run script `result` string, Authorization the
   scoped cloud credential. Enable secure inputs/outputs for this HTTP step.
   Set the same credential as the secret runtime variable `CLOUD_SALES_TOKEN`
   through Sites; never place it in this document, the workbook, or source control.
6. Validate response `ok`, `period`, and `latestDate`. Compare latestDate with
   yesterday in Bangkok. If missing, re-read and send a fresh report every 5 minutes,
   at most 6 times. Retry 409/429/5xx transient failures with a fresh run as needed.
   If still behind or authentication fails, fail the flow visibly; never synthesize
   the missing date or sales. Existing good data remains visible.
7. Test against the real source, verify the report day and totals in the website,
   then enable recurrence. The first success activates the site's cloud indicator.
8. Pause the old local `sales-report-10-00` Codex automation after this succeeds.
   The Mac snapshot process can continue for other sections: it cannot overwrite
   sales months already supplied by the cloud flow.

## Storage and failure behavior

- Cloud sales live in a separate R2 object; the existing dashboard snapshot remains.
- Each delivery updates one month and preserves other months.
- Missing/invalid numeric data, older report dates and stale exports are rejected.
- Conditional storage writes reject concurrent edits instead of silently losing data.
- `/api/sync/daily-sales` requires its separately provisioned secret.
- No cloud schedule is created by deploying the receiver alone.

Microsoft references:
- https://learn.microsoft.com/en-us/power-automate/run-scheduled-tasks
- https://learn.microsoft.com/en-us/office/dev/scripts/develop/power-automate-integration
- https://learn.microsoft.com/en-us/connectors/excelonlinebusiness/
