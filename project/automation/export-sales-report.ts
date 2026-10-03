// Office Script: read the existing workbook; return allow-listed sales fields only.
// Power Automate passes reportPeriod as yyyy-MM in Asia/Bangkok.
function main(workbook: ExcelScript.Workbook, reportPeriod: string): string {
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(reportPeriod))throw new Error('Invalid report period');
  const now=new Date();
  const today=new Date(now.getTime()+7*3600000).toISOString().slice(0,10);
  const matches: SalesPeriod[]=[];
  for(const sheet of workbook.getWorksheets()){
    if(!sheet.getName().replace(/\s/g,'').includes('ยอดขาย'))continue;
    const range=sheet.getUsedRange(true);
    if(!range)continue;
    if(range.getRowCount()>2000||range.getColumnCount()>200)continue;
    const rows=range.getTexts(), values=range.getValues();
    const headerIndex=rows.findIndex(row=>row[0]?.trim()==='ลำดับ'&&row[3]?.trim()==='สาขา');
    if(headerIndex<0)continue;
    const header=rows[headerIndex].map(v=>v.trim());
    const codeColumn=header.indexOf('รหัสสาขา'),branchColumn=header.indexOf('สาขา');
    const typeColumn=header.indexOf('ประเภท'),targetColumn=header.indexOf('เป้าหมาย');
    const mtdColumn=header.indexOf('ยอดขายปัจจุบัน');
    if([codeColumn,branchColumn,typeColumn,targetColumn,mtdColumn].some(v=>v<0))continue;
    const dateColumns=header.map((label,index)=>({index,date:salesDate(label,values[headerIndex][index])})).filter(c=>c.date.startsWith(reportPeriod+'-'));
    if(dateColumns.length<28)continue;
    const branches: SalesBranch[]=[];
    for(let rowIndex=headerIndex+1;rowIndex<rows.length;rowIndex++){
      const row=rows[rowIndex];
      // Row-number formulas are presentation only: an error must not hide a
      // valid coded store. Summary/header rows have neither identity signal.
      const numbered=/^\d+$/.test(row[0]?.trim());
      const coded=/^V[A-Z]-\d+$/i.test(row[codeColumn]?.trim());
      if((!numbered&&!coded)||!row[branchColumn]?.trim())continue;
      const daily: {[date:string]:number|null}={};
      for(const col of dateColumns)daily[col.date]=col.date>today?null:salesNumber(row[col.index]);
      const branch:SalesBranch={branch_code:row[codeColumn].trim(),branch:row[branchColumn].trim(),type:row[typeColumn].trim(),month_to_date:salesNumber(row[mtdColumn])??0,target:salesNumber(row[targetColumn])??0,daily_sales:daily};
      if(branch.month_to_date!==0||branch.target!==0||Object.values(daily).some(v=>v!==null&&v!==0))branches.push(branch);
    }
    if(!branches.length)continue;
    const dates=dateColumns.map(c=>c.date).sort();
    // Blank / dash formula cells remain null. Explicit numeric zero is a reported day.
    const latest=[...dates].reverse().find(date=>date<=today&&branches.some(b=>b.daily_sales[date]!==null));
    if(!latest)throw new Error('No reported daily sales in target month');
    matches.push({year:Number(reportPeriod.slice(0,4)),month:Number(reportPeriod.slice(5,7)),dates,latest_date:latest,branches});
  }
  if(matches.length!==1)throw new Error('Expected exactly one sales worksheet for '+reportPeriod+'; found '+matches.length);
  const period=matches[0];
  console.log(JSON.stringify({period:reportPeriod,latestDate:period.latest_date,branches:period.branches.length,dailyTotal:period.branches.reduce((sum,b)=>sum+(b.daily_sales[period.latest_date]??0),0),monthToDate:period.branches.reduce((sum,b)=>sum+b.month_to_date,0)}));
  const periods:{[key:string]:SalesPeriod}={};periods[reportPeriod]=period;
  const payload=JSON.stringify({version:2,exportedAt:now.toISOString(),source:{as_of_date:period.latest_date,fetched_at:now.toISOString()},periods});
  // Excel Online exposes console output to the authenticated browser session.
  console.log('VING_SALES_JSON_BEGIN'+payload+'VING_SALES_JSON_END');
  return payload;
}

interface SalesBranch {branch_code:string;branch:string;type:string;month_to_date:number;target:number;daily_sales:{[date:string]:number|null}}
interface SalesPeriod {year:number;month:number;dates:string[];latest_date:string;branches:SalesBranch[]}
function salesNumber(value:string):number|null {
  const cleaned=String(value??'').trim().replace(/[,฿\s]/g,'');
  if(!cleaned||/^[—–-]$/.test(cleaned))return null;
  const parsed=Number(cleaned);
  if(!Number.isFinite(parsed))throw new Error('Invalid numeric sales cell');
  return parsed;
}
function salesDate(label:string, value:string|number|boolean):string {
  const match=label.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(match){
    const year=Number(match[3])>2400?Number(match[3])-543:Number(match[3]);
    const date=new Date(Date.UTC(year,Number(match[2])-1,Number(match[1])));
    if(date.getUTCFullYear()===year&&date.getUTCMonth()+1===Number(match[2])&&date.getUTCDate()===Number(match[1]))return date.toISOString().slice(0,10);
  }
  if(typeof value==='number'&&value>36525&&value<80000)return new Date(Date.UTC(1899,11,30)+Math.trunc(value)*86400000).toISOString().slice(0,10);
  return '';
}
