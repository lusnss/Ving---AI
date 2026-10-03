"""Read only: extract the four requested groups from Daily report.

Usage: python import-daily-comparison.py source-2569.xlsx [source-2568.xlsx]
Original workbooks and personal information must never enter the Site checkout.
"""
import calendar
import datetime as dt
import json
import re
import sys
from pathlib import Path
import openpyxl

GROUPS = ['Stand Alone', 'EVENT', 'EVENT นอก', 'Department Stores']
IDS = {2569: '1z9Xs0JJWQHbBP2J54NLfUSDQcaNBmgTi', 2568: '1nZoPt2AkeNJDJ05-rQizRNBPWUoqWEgG'}
ROOT = Path(__file__).resolve().parents[1]

def number(value):
    return round(float(value), 2) if isinstance(value, (int, float)) and not isinstance(value, bool) else None

def channel(group, value):
    if group == 'Department Stores': return 'ห้าง'
    if group == 'EVENT': return 'EVENT ในห้าง GP / ลานโปร ห้าง'
    if group == 'EVENT นอก': return 'EVENT นอก เก็บเงินเอง ห้าง'
    value = re.sub(r'\([^)]*\)', '', str(value))
    value = re.sub(r'\s+', ' ', value).strip()
    value = re.sub(r'^Stand Alone\s+', '', value, flags=re.I)
    value = {'Thaphra : VING+':'Thaphra : VING', 'Ngamwongwan':'Ngamwongwan (ไม่แยกแบรนด์)'}.get(value,value)
    # An allowlist prevents staff annotations from being carried into the report.
    permitted = {'Rama 9', 'Rangsit', 'Westgate', 'Hatyai', 'Thaphra : VING', 'Thaphra : TORANi',
                 'Ngamwongwan : VING', 'Ngamwongwan : TORANi', 'Flagship สนามเทพหัสดิน',
                 'Rayong', 'Pinklao', 'Chiangmai Airport', 'Outlet Store PARADISE PARK',
                 'Pop up Store UDON', 'Pop Up Store Chonburi', 'Chaengwattana', 'Bangkapi', 'Ngamwongwan (ไม่แยกแบรนด์)'}
    if value not in permitted: raise ValueError('Unreviewed channel at source: review its label before publishing')
    return value

def extract(filename, year):
    wb = openpyxl.load_workbook(filename, read_only=True, data_only=True)
    sheet = wb['Sheet1' if year == 2568 else 'Daily report']
    records = []; month = None; dates = []; seen = set()
    # This sheet has 12 monthly sections; only the known sales columns are read.
    for rowno, row in enumerate(sheet.iter_rows(max_row=1600, max_col=42, values_only=True), 1):
        if str(row[2]).strip() == 'Group':
            assert isinstance(row[10], dt.datetime), f'Missing date header at row {rowno}'
            header_year = row[10].year
            assert header_year in (year, year - 543), f'Wrong workbook year at row {rowno}'
            month = row[10].month
            dates = [(i, v.day) for i, v in enumerate(row) if isinstance(v, dt.datetime) and v.month == month]
            assert len(dates) == calendar.monthrange(year - 543, month)[1]
            continue
        group = str(row[2]).strip()
        if group not in GROUPS: continue
        assert month is not None
        name = channel(group, row[4])
        key = (month, group, name)
        daily = [number(row[i]) for i, day in dates]
        marks = [day for (i, day) in dates if isinstance(row[i], str) and row[i].strip()]
        recorded = [day for (i, day), v in zip(dates, daily) if v is not None]
        gross, net, before_vat, refunds = map(number, (row[9], row[6], row[7], row[8]))
        if key in seen:
            previous = next(r for r in records if (r['month'], r['group'], r['channel']) == key)
            if previous['lastDay'] is None and previous['gross'] is None:
                records.remove(previous)
            elif not recorded and gross in (None, 0):
                continue
            else:
                raise ValueError(f'Duplicate populated channel at row {rowno}')
        seen.add(key)
        summed = round(sum(v for v in daily if v is not None), 2)
        assert gross is None or abs(summed - gross) < 0.02, f'Daily/month mismatch at row {rowno}'
        if net is not None and gross is not None and refunds is not None:
            assert abs(gross - refunds - net) < 0.02, f'Net mismatch at row {rowno}'
        records.append(dict(year=year, month=month, group=group, channel=name, row=rowno,
                            daily=daily, marks=marks, net=net if recorded else None,
                            beforeVat=before_vat if recorded else None,
                            refunds=refunds, gross=gross if recorded else None,
                            lastDay=max(recorded) if recorded else None))
    wb.close()
    assert len(set(r['month'] for r in records)) == 12
    return records

def main():
    now = dt.datetime.now(dt.timezone.utc).isoformat()
    data = dict(version=1, extractedAt=now, sheet='Daily report', groups=GROUPS, sources={}, records=[])
    for year, path in [(2569, sys.argv[1]), (2568, sys.argv[2] if len(sys.argv) > 2 else None)]:
        data['sources'][str(year)] = dict(year=year, status='ready' if path else 'unavailable', sheet='Daily report' if year==2569 else 'Sheet1')
        if year==2569: data['sources'][str(year)]['url']=f'https://docs.google.com/spreadsheets/d/{IDS[year]}/edit?gid=657843391#gid=657843391'
        elif path: data['sources'][str(year)]['fileName']='salse 2025.xlsx'
        if path: data['records'].extend(extract(path, year))
    output = ROOT / 'out/assets/daily-comparison-data.mjs'
    output.write_text('export const reportData = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    for year in [2569,2568]:
      for group in GROUPS:
        rows = [r for r in data['records'] if r['year'] == year and r['group'] == group]
        print(year,group, 'rows:', len(rows), 'daily total:', round(sum(v for r in rows for v in r['daily'] if v is not None),2))
    print('Saved only reviewed channel labels, dates and numeric sales data.')

if __name__ == '__main__': main()
