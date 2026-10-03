const salesModelKey = value => String(value ?? '').normalize('NFKC').trim().replace(/_/g,' ').replace(/\s+/g,' ').toLocaleLowerCase();
const scenarioNumber = value => Number.isFinite(value) ? value : '';
const validTarget = target => Number.isInteger(target) && target >= 0 && target <= 1_000_000_000;

export function stockSalesAllocation(items, history, target = 1000) {
  const sales = new Map();
  for (const row of history?.models || []) {
    if (!Number.isFinite(row.qty) || row.qty <= 0) continue;
    const key = salesModelKey(row.model);
    sales.set(key, (sales.get(key) || 0) + row.qty);
  }
  const rows = items.map(item => ({historyQty:sales.get(salesModelKey(item.model)) ?? null}));
  const total = rows.reduce((sum,row) => sum + (row.historyQty || 0),0);
  // Fixed cumulative historical intervals make integer allocation independent of
  // worksheet row order. Adjacent rounded boundaries telescope to the exact target.
  let cumulative = 0;
  const ordered = rows.map((row,index) => ({row,key:salesModelKey(items[index].model)}))
    .sort((a,b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
  for (const {row} of ordered) {
    row.share = row.historyQty !== null && total > 0 ? row.historyQty / total : null;
    row.before = cumulative;
    cumulative += row.historyQty || 0;
    row.after = cumulative;
    row.qty = row.share !== null && validTarget(target)
      ? Math.round(target * row.after / total) - Math.round(target * row.before / total) : null;
  }
  return {rows, total, known:rows.filter(row => row.historyQty !== null).length};
}

export function withStockSalesScenario(sheet, report, state = {}) {
  const target = state.forecastTarget ?? 1000, history = report.salesHistory;
  const allocation = stockSalesAllocation(report.models, history, target);
  const originalIntro = sheet.rows.slice(1,6), records = sheet.rows.slice(7,-1);
  const start = 8, end = Math.max(start, start + records.length - 1);
  const headers = [...sheet.rows[6].values,'ประวัติ Report สินค้าขายดี','ยอดขายที่บันทึก (ชิ้น)','สัดส่วนยอดขาย (%)','คาดการณ์ขาย (ชิ้น)','ยอดขายคาดการณ์ (บาท)','กำไรคาดการณ์ (บาท)'];
  const tableName = 'VingStockSummary';
  const columnIndex = column => column.charCodeAt(0)-65;
  const range = column => `${tableName}[${headers[columnIndex(column)]}]`;
  // Resolve inputs from the current row even after Excel moves the formula during sorting.
  const current = column => records.length === 1 ? `$${column}$${start}` : `INDEX($${column}$${start}:$${column}$${end},ROW()-${start-1})`;
  const targetOk = 'IF(ISNUMBER($H$2),AND($H$2>=0,$H$2<=1000000000,INT($H$2)=$H$2),FALSE)';
  const quantityReady = `AND(${targetOk},COUNT(${range('O')})>0)`;
  // Q contains numeric profit or an empty string. Use revenue from those same
  // rows for GP, so a missing cost never gets treated as a zero cost.
  const profitRevenue = `SUMPRODUCT(--($Q$${start}:$Q$${end}<>""),$P$${start}:$P$${end})`;
  let revenue = 0, profit = 0, matchedRevenue = 0, missingPrice = 0, missingProfit = 0;
  records.forEach((row,index) => {
    const r = start+index, projected = allocation.rows[index];
    const income = projected.qty === null ? null : projected.qty === 0 ? 0 : typeof row.values[8] === 'number' ? Math.round(projected.qty*row.values[8]*100)/100 : null;
    const margin = projected.qty === null ? null : projected.qty === 0 ? 0 : typeof row.values[10] === 'number' ? Math.round(projected.qty*row.values[10]*100)/100 : null;
    if(projected.qty!==null) {missingPrice += income===null ? 1 : 0;missingProfit += margin===null ? 1 : 0;}
    if(margin!==null && income!==null) matchedRevenue += income;
    revenue += income || 0; profit += margin || 0;
    row.values.push(projected.historyQty !== null ? 'มีข้อมูลบันทึก' : history?.status==='unavailable' ? 'ยังอ่านข้อมูลไม่ได้' : 'ไม่มีข้อมูลบันทึก',scenarioNumber(projected.historyQty),scenarioNumber(projected.share),scenarioNumber(projected.qty),scenarioNumber(income),scenarioNumber(margin));
    row.decimalColumns.push(15,16); row.percentColumns.push(13);
    row.formulas = Object.fromEntries(Object.entries(row.formulas).map(([column,formula]) =>
      [column,formula.replace(new RegExp(`([EFHI])${r}\\b`, 'g'), (_,letter) => current(letter))]));
    Object.assign(row.formulas, {
      14:projected.share === null ? '""' : `IF(${targetOk},ROUND($H$2*${projected.after}/${allocation.total},0)-ROUND($H$2*${projected.before}/${allocation.total},0),"")`,
      15:`IF(ISNUMBER(${current('O')}),IF(${current('O')}=0,0,IF(ISNUMBER(${current('I')}),ROUND(${current('O')}*${current('I')},2),"")),"")`,
      16:`IF(ISNUMBER(${current('O')}),IF(${current('O')}=0,0,IF(ISNUMBER(${current('K')}),ROUND(${current('O')}*${current('K')},2),"")),"")`
    });
  });
  const ready = validTarget(target) && allocation.known>0;
  revenue = ready ? Math.round(revenue*100)/100 : '';
  profit = ready ? Math.round(profit*100)/100 : '';
  const gp = ready && matchedRevenue>0 ? profit/matchedRevenue : '';
  const completeStatus = 'สรุปจากข้อมูลครบ · ยอดขายและกำไรเปลี่ยนตามจำนวนและส่วนลด · GP = กำไรรวม ÷ ยอดขายรวม';
  const partialStatus = `สรุปเฉพาะข้อมูลที่มี · ยังไม่รวมยอดขาย ${missingPrice} รุ่น / กำไร ${missingProfit} รุ่นที่ข้อมูลไม่ครบ · GP ใช้รายการราคาและต้นทุนครบ`;
  const summaryStatus = !validTarget(target) ? 'กรอกจำนวนเต็มตั้งแต่ 0 ถึง 1,000,000,000 ชิ้น' : !allocation.known ? 'ยังไม่มีประวัติขายที่ใช้คาดการณ์ได้ · เว้นค่าคาดการณ์ไว้' : missingPrice || missingProfit ? partialStatus : completeStatus;
  const row = (values, kind='body', extra={}) => ({values,kind,...extra});
  const intro = (value,height=36) => row([value],'body',{height,overflowColumns:[0]});
  const cards = [{start:0,end:5},{start:7,end:8},{start:9,end:10}];
  const months = history?.months || [];
  const source = months.length ? `Report สินค้าขายดี · ${months.length} เดือนที่บันทึกครบ (${months[0]} ถึง ${months.at(-1)}) · ทุกสาขา / ทุกเกรด` : history?.status==='unavailable' ? 'ยังอ่านประวัติ Report สินค้าขายดีที่บันทึกไว้ไม่ได้' : 'ไม่มีเดือนที่บันทึกครบใน Report สินค้าขายดี';
  const totals = sheet.rows.at(-1);
  totals.values.push('',allocation.total,allocation.known?1:'',ready?target:'',revenue,profit);
  totals.decimalColumns=[15,16];totals.percentColumns=[13];
  totals.formulas={
    12:records.length?`SUM(${range('M')})`:'0',
    14:records.length?`IF(${quantityReady},SUM(${range('O')}),"")`:'""',
    15:'IF(ISNUMBER(A4),A4,"")',16:'IF(ISNUMBER(H4),H4,"")'
  };
  sheet.widths.push(26,22,18,24,28,28);
  sheet.rows[6].values=headers;
  sheet.rows = [
    {...sheet.rows[0],merge:11},
    row(['สมมุติขายได้ (ชิ้น)','','','','','','',target,'จัดสรรคาดการณ์ (ชิ้น)',ready?target:'','ชิ้น'], 'group', {height:38,integerInputColumns:[7],merges:[{start:0,end:6}],formulas:{9:records.length?`IF(${quantityReady},SUM(${range('O')}),"")`:'""'}}),
    row(['คาดการณ์ยอดขาย (บาท)','','','','','','','กำไรขั้นต้นคาดการณ์ (บาท)','','GP% จากรายการข้อมูลครบ'], 'group', {height:28,merges:cards}),
    row([revenue,'','','','','','',profit,'',gp], 'title', {height:44,merges:cards,decimalColumns:[0,7],percentColumns:[9],formulas:{
      0:records.length?`IF(${quantityReady},SUM(${range('P')}),"")`:'""',
      7:records.length?`IF(${quantityReady},SUM(${range('Q')}),"")`:'""',
      9:records.length?`IF(AND(ISNUMBER(H4),${profitRevenue}>0),H4/${profitRevenue},"")`:'""'
    }}),
    row([summaryStatus], 'stripe', {merge:11,height:36,formulas:{0:records.length?`IF(NOT(${targetOk}),"กรอกจำนวนเต็มตั้งแต่ 0 ถึง 1,000,000,000 ชิ้น",IF(COUNT(${range('O')})=0,"ยังไม่มีประวัติขายที่ใช้คาดการณ์ได้ · เว้นค่าคาดการณ์ไว้",IF(OR(COUNT(${range('P')})<COUNT(${range('O')}),COUNT(${range('Q')})<COUNT(${range('O')})),"สรุปเฉพาะข้อมูลที่มี · ยังไม่รวมยอดขาย "&(COUNT(${range('O')})-COUNT(${range('P')}))&" รุ่น / กำไร "&(COUNT(${range('O')})-COUNT(${range('Q')}))&" รุ่นที่ข้อมูลไม่ครบ · GP ใช้รายการราคาและต้นทุนครบ","${completeStatus}")))`:'"ยังไม่มีประวัติขายที่ใช้คาดการณ์ได้"'}}),
    {...intro(source+` · มีประวัติ ${allocation.known} รุ่น / ${history?.status==='unavailable'?'ยังอ่านไม่ได้':'ไม่มีประวัติ'} ${records.length-allocation.known} รุ่น`+'\nกระจายตามสัดส่วนเฉพาะรุ่นในไฟล์ที่มีประวัติ · ปัดจำนวนเต็มจากสัดส่วนสะสม รวมเท่าจำนวนสมมุติ · ไม่จำกัดตามสต็อก · รุ่นไม่มีประวัติเว้นว่าง',44),merge:11,overflowColumns:[]},
    sheet.rows[6],...records,row([], 'body', {height:10}),totals,
    row([], 'body', {height:10}),
    ...originalIntro.map(({merge,merges,...item})=>({...item,overflowColumns:[0]})),
    intro('เดือนที่ใช้: '+(months.join(', ')||'ไม่มี')+(history?.skippedMonths?.length?' · ไม่นำเดือนที่อ่านไม่ครบมาคำนวณ: '+history.skippedMonths.join(', '):'')+' · เป็นจำนวนขายออกตาม Report สินค้าขายดี ยังไม่หักคืนสินค้า · เป็นสมมุติฐานตามสัดส่วนเดิม ไม่ใช่ยอดขายที่ยืนยันแล้ว',44),
    intro('ประวัติถูกอ่านเมื่อ: '+(history?.fetchedAt||'ไม่พบข้อมูล')+' · เปลี่ยนจำนวนสมมุติ H2 หรือส่วนลด H แล้วสรุปด้านบนจะคำนวณใหม่ · ยอดขายรวมเฉพาะรายการที่มีราคา · กำไรและ GP ใช้เฉพาะรายการที่มีราคาและต้นทุนครบ',42)
  ];
  sheet.validations.unshift({range:'H2',type:'whole',operator:'between',formula1:'0',formula2:'1000000000',promptTitle:'จำนวนสมมุติ',prompt:'กรอกจำนวนชิ้น เช่น 1000',errorTitle:'จำนวนไม่ถูกต้อง',error:'กรอกจำนวนเต็มตั้งแต่ 0 ถึง 1,000,000,000'});
  if(records.length) sheet.table={name:tableName,headerRow:7,endRow:end};
  return sheet;
}
