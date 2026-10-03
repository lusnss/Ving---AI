# VING Sales Report: Excel Online to website

Verified on 17 September 2026: the source contained sales through 16 September.
The sales-only endpoint accepted the report and the live Sales Report selected
16 September with MTD 2,991,622.89 (displayed as 2,991,623).

The signed-in Microsoft account has Office Scripts and standard Power Automate,
but lacks Premium HTTP actions. No paid service was enabled. Use the existing
Codex daily 18:00 Asia/Bangkok task on this Mac. The computer and Codex must be
running and the Microsoft session must remain available. Do not claim that a
Power Automate cloud flow is active.

## Each run

1. Use `cua_repl` to select the signed-in in-app browser and the existing workbook
   `Sales Report 2026 PC VING.xlsx`. The original URL is in the source document
   `/Users/bright/Documents/VIng - AI /ลิงค์ DATA Backup (ยอดขายห้าง).rtfd/TXT.rtf`,
   Sales Report entry, sourcedoc `4683C9CE-44C2-4D99-93C7-575CFFEFC84B`.
   Do not download XLSX/CSV, alter workbook cells, change sharing, or extract tokens.
2. Open Automate and the saved Office Script **VING Export Sales Report**. It uses
   `export-sales-report.ts` in this directory. Run it with `reportPeriod` equal to
   the the current Bangkok month (`yyyy-MM`), including the new year after December. On days 1–3, also refresh the previous month first to capture closing sales, then refresh the current month. Keep each run's JSON and timestamps intact. If the current month has no worksheet or reported daily sales, retain history and report that the current month is waiting; never relabel prior-month sales.
   Read fresh UI state to locate controls. If a nested iframe click fails on
   fractional coordinates, use the visible button's locator `press('Enter')`.
3. The Results list has a compact summary and a full JSON entry between the exact
   markers `VING_SALES_JSON_BEGIN` and `VING_SALES_JSON_END`. Read only this list item
   from the visible DOM and keep the complete string in the browser REPL; do not
   transcribe individual amounts. Strip the two markers and parse JSON. Do not use
   the compact summary as the report. Do not print the full workbook DOM or iframe
   attributes (they can contain Microsoft authentication metadata).
4. Start the one-shot bridge with the bundled Node runtime:

   `/Users/bright/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node /Users/bright/Documents/VIng - AI /warroom-online-sales/automation/upload-online-sales.mjs`

   The script reads the sales-only credential from the ignored local runtime
   directory; never display or copy it into browser/script/workbook/git. It binds
   only to 127.0.0.1 and closes after one success or 15 minutes. If the port is
   occupied, inspect the existing process before deciding whether it is this tool;
   do not terminate unrelated processes.
5. Open `http://127.0.0.1:8768/` in the same in-app browser. Paste the exact JSON
   string into **ข้อมูลยอดขายออนไลน์**, then click **ตรวจสอบและส่งยอดเข้าเว็บ**.
   This form forwards only sanitized sales fields to the authorized existing site:
   `https://ving-warroom-view.cloudy-spoon-1359.chatgpt.site/api/sync/daily-sales`.
   It does not save a report file or Microsoft credential.
6. Verify `ok: true`, period and latestDate on the result page. Verify the website
   `/daily-sales` through normal login: the selected date and MTD must match.
   Keep the useful website tab open; preserve the Excel session for the next run.
   The routine Mac snapshot cannot overwrite sales delivered through this endpoint.

Exports expire after 15 minutes. Rerun Office Script if expired; never rewrite its
timestamp. If the source is behind yesterday, report the actual latest date and
the delay. Keep existing good data on authentication, validation or upload failure.
No data is fabricated, and no new paid license, access grant or source sharing is
part of this workflow. Do not activate the unfinished Power Automate HTTP draft.

## Automatic month selection (2 October 2026)

The saved Office Script also accepts a valid V*-number store code when its display ordinal is blank or a formula error. September had `#VALUE!` ordinals for VA-001 and VA-003; never use ordinal validity alone to omit a store. Headers and total rows remain excluded, and errors in actual sales cells still stop the import.

The website opens in current-month mode using Asia/Bangkok. Its periodic refresh includes the Bangkok date, so a tab left open rolls forward at month/year boundaries. Choosing a year, month or report date pins that selection. The current-month button resumes automatic selection. Missing current-month data is shown as waiting, not as prior-month sales or a reported zero. The existing 18:00 Codex heartbeat now reads the current month, plus the prior closing month on days 1–3. This still requires the Mac, Codex and the signed-in Microsoft session; direct Graph OAuth is not configured.
