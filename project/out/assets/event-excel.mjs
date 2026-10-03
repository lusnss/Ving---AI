export const eventExcelColumns=['ประเภท','สถานที่','ชื่อ','ช่วงวันที่จัด','จำนวนวันที่จัด','จำนวน PC','ค่าขนส่ง','ค่าใช้จ่ายอื่นๆ'];
const number=value=>value===null||value===undefined||String(value).trim()===''?null:Number.isFinite(Number(String(value).replaceAll(',','')))?Number(String(value).replaceAll(',','')):null;
const date=value=>value.split('-').reverse().join('/');
export function eventExcelRows(items){
 return items.map(item=>[
  item.category==='direct'?'Event เก็บเงินเอง':item.category==='gp'?'Event จ่าย GP':item.eventTypes?.length?item.eventTypes.join(', '):'',
  item.place||'',item.name||'',item.range?`${date(item.range.start)} – ${date(item.range.end)}`:item.dates||item.date||'',
  item.range?Math.round((Date.parse(item.range.end)-Date.parse(item.range.start))/86400000)+1:number(item.days),
  number(item.pcCount),number(item.shipping),number(item.other)
 ]);
}
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const encoder=new TextEncoder();
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
function zip(files){
 const local=[],central=[];let offset=0,centralSize=0;
 for(const [path,content] of Object.entries(files)){
  const name=encoder.encode(path),body=encoder.encode(content),crc=crc32(body);
  const header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint16(12,33,true);
  view.setUint32(14,crc,true);view.setUint32(18,body.length,true);view.setUint32(22,body.length,true);view.setUint16(26,name.length,true);header.set(name,30);
  local.push(header,body);
  const entry=new Uint8Array(46+name.length),v=new DataView(entry.buffer);
  v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint16(14,33,true);
  v.setUint32(16,crc,true);v.setUint32(20,body.length,true);v.setUint32(24,body.length,true);v.setUint16(28,name.length,true);v.setUint32(42,offset,true);entry.set(name,46);
  central.push(entry);centralSize+=entry.length;offset+=header.length+body.length;
 }
 const end=new Uint8Array(22),v=new DataView(end.buffer),count=central.length;
 v.setUint32(0,0x06054b50,true);v.setUint16(8,count,true);v.setUint16(10,count,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);
 const result=new Uint8Array(offset+centralSize+end.length);let position=0;
 for(const bytes of [...local,...central,end]){result.set(bytes,position);position+=bytes.length;}
 return result;
}
// A small, self-contained OOXML workbook. Text is always inlineStr, never an Excel formula.
export function eventExcelWorkbook(items){
 return tableExcelWorkbook(eventExcelColumns,eventExcelRows(items),[25,30,55,30,20,16,18,20],{4:2,5:2,6:3,7:3});
}
export function tableExcelWorkbook(columns,data,widths,numericStyles={}){
 return zip(tableExcelFiles(columns,data,widths,numericStyles));
}
export function excelColumnName(index){let name='';for(let n=index+1;n>0;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;}
function tableExcelFiles(columns,data,widths,numericStyles={}){
 const rows=[columns,...data],last=rows.length,endColumn=excelColumnName(columns.length-1);
 const cells=rows.map((row,i)=>`<row r="${i+1}"${i===0?' ht="30" customHeight="1"':''}>${row.map((value,j)=>{
  const ref=excelColumnName(j)+(i+1),style=i===0?1:numericStyles[j]||0;
  return typeof value==='number'?`<c r="${ref}" s="${style}"><v>${value}</v></c>`:value===null?`<c r="${ref}" s="${style}"/>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
 }).join('')}</row>`).join('');
 const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 return {
  '[Content_Types].xml':declaration+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
  '_rels/.rels':declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':declaration+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Events" sheetId="1" r:id="rId1"/></sheets></workbook>',
  'xl/_rels/workbook.xml.rels':declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':declaration+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><color rgb="FF24221B"/><name val="Tahoma"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE1C991"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
  'xl/worksheets/sheet1.xml':declaration+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${endColumn}${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="30"/><cols>${widths.map((width,i)=>`<col min="${i+1}" max="${i+1}" width="${width}" customWidth="1"/>`).join('')}</cols><sheetData>${cells}</sheetData><autoFilter ref="A1:${endColumn}${last}"/></worksheet>`
 };
}
export function sectionTableExcelWorkbook(sections){
 const first=sections[0],files=tableExcelFiles(first.columns,[],first.widths,first.numericStyles);
 const endColumn=excelColumnName(Math.max(...sections.map(s=>s.columns.length))-1);
 const rows=[],merges=[];let offset=0;
 for(const section of sections){
  const title=offset+1;
  rows.push(`<row r="${title}" ht="32" customHeight="1"><c r="A${title}" s="1" t="inlineStr"><is><t>${xml(section.name)} · ${section.data.length} งาน</t></is></c></row>`);
  merges.push(`<mergeCell ref="A${title}:${endColumn}${title}"/>`);
  const sheet=tableExcelFiles(section.columns,section.data,section.widths,section.numericStyles)['xl/worksheets/sheet1.xml'];
  const body=sheet.match(/<sheetData>([\s\S]*?)<\/sheetData>/)[1];
  rows.push(body.replace(/r="([A-Z]*)(\d+)"/g,(_,column,row)=>`r="${column}${Number(row)+title}"`));
  offset=title+section.data.length+2;
 }
 files['xl/workbook.xml']=files['xl/workbook.xml'].replace('name="Events"','name="Event Proposals"');
 files['xl/worksheets/sheet1.xml']=files['xl/worksheets/sheet1.xml']
  .replace(/<dimension[^>]*\/>/,`<dimension ref="A1:${endColumn}${offset-1}"/>`)
  .replace('ySplit="1" topLeftCell="A2"','ySplit="2" topLeftCell="A3"')
  .replace(/<sheetData>[\s\S]*?<\/sheetData>/,`<sheetData>${rows.join('')}</sheetData><mergeCells count="${merges.length}">${merges.join('')}</mergeCells>`)
  .replace(/<autoFilter[^>]*\/>/,'');
 return zip(files);
}
export function multiTableExcelWorkbook(sheets){
 if(!sheets.length)throw new Error('No worksheets');
 const files=tableExcelFiles(sheets[0].columns,sheets[0].data,sheets[0].widths,sheets[0].numericStyles);
 const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 files['xl/workbook.xml']=declaration+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets></workbook>';
 files['xl/_rels/workbook.xml.rels']=declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 for(let i=1;i<sheets.length;i++){
  const s=sheets[i];files[`xl/worksheets/sheet${i+1}.xml`]=tableExcelFiles(s.columns,s.data,s.widths,s.numericStyles)['xl/worksheets/sheet1.xml'];
  files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>',`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
 }
 return zip(files);
}
export function downloadEventExcel(items,year,month,status){
 downloadExcelWorkbook(eventExcelWorkbook(items),`VING-Events-${year}-${String(month).padStart(2,'0')}-${status}.xlsx`);
}
export function downloadExcelWorkbook(bytes,filename){
 const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;
 document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}

// Structured reports use explicit typed values. Only row.formulas authored by the application are formulas; imported text stays literal.
export function reportExcelWorkbook(sheets){
 const files=tableExcelFiles([''],[],[24]);
 const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
 files['xl/workbook.xml']=declaration+'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')+'</sheets><calcPr calcId="191029" calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>';
 files['xl/_rels/workbook.xml.rels']=declaration+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')+`<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
 const palettes=[['0','0'],['1','2'],['0','3'],['1','4'],['1','5'],['2','6']];
 files['xl/styles.xml']=declaration+'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0;[Red](#,##0);&quot;—&quot;"/></numFmts><fonts count="4"><font><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="11"/><name val="Tahoma"/></font><font><b/><sz val="18"/><color rgb="FFFFFFFF"/><name val="Tahoma"/></font><font><sz val="11"/><color rgb="FF1565C0"/><name val="Tahoma"/></font></fonts><fills count="8"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'+['E8D8AE','F1F5F8','DCEAE7','DCE4EF','243345','FFF2CC'].map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')+'</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="32">'+palettes.flatMap(([font,fill])=>[false,true].map(n=>`<xf numFmtId="${n?164:0}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" horizontal="${n?'right':'left'}" wrapText="1"/></xf>`)).join('')+palettes.map(([font,fill])=>`<xf numFmtId="4" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" horizontal="right" wrapText="1"/></xf>`).join('')+palettes.map(([font,fill])=>`<xf numFmtId="10" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" horizontal="right" wrapText="1"/></xf>`).join('')+'<xf numFmtId="10" fontId="3" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" horizontal="right"/><protection locked="0"/></xf><xf numFmtId="3" fontId="3" fillId="7" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="center" horizontal="right"/><protection locked="0"/></xf>'+palettes.map(([font,fill])=>`<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" horizontal="left" wrapText="0"/></xf>`).join('')+'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
 for(const [index,sheet] of sheets.entries()){
  const merges=[],end=excelColumnName(sheet.widths.length-1),kinds={body:0,header:2,stripe:4,total:6,group:8,title:10};
  const rows=sheet.rows.map((row,i)=>{const values=[...row.values],base=kinds[row.kind]??0;if(row.merge){merges.push(`<mergeCell ref="A${i+1}:${excelColumnName(row.merge-1)}${i+1}"/>`);while(values.length<row.merge)values.push('');}for(const span of row.merges||[]){merges.push(`<mergeCell ref="${excelColumnName(span.start)}${i+1}:${excelColumnName(span.end)}${i+1}"/>`);while(values.length<=span.end)values.push('');}return `<row r="${i+1}" ht="${row.height||28}" customHeight="1">${values.map((v,j)=>{const numeric=typeof v==='number'&&Number.isFinite(v),style=row.overflowColumns?.includes(j)?26+base/2:row.integerInputColumns?.includes(j)?25:row.inputColumns?.includes(j)?24:row.percentColumns?.includes(j)?18+(row.totalColumn===j?6:base)/2:(row.decimalColumns?.includes(j)||numeric&&!Number.isInteger(v))?12+(row.totalColumn===j?6:base)/2:(row.totalColumn===j?6:base)+(numeric?1:0),ref=excelColumnName(j)+(i+1);if((row.inputColumns?.includes(j)||row.integerInputColumns?.includes(j))&&(v===''||v==null))return `<c r="${ref}" s="${style}"/>`;const formula=row.formulas?.[j];if(typeof formula==='string')return `<c r="${ref}" s="${style}"${numeric?'':' t="str"'}><f>${xml(formula)}</f><v>${numeric?v:xml(v)}</v></c>`;return numeric?`<c r="${ref}" s="${style}"><v>${v}</v></c>`:`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;}).join('')}</row>`;}).join('');
  const y=sheet.freezeRows||0,x=sheet.freezeCols||0,active=x&&y?'bottomRight':x?'topRight':'bottomLeft';
  files[`xl/worksheets/sheet${index+1}.xml`]=declaration+`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${end}${sheet.rows.length}"/><sheetViews><sheetView showGridLines="0" workbookViewId="0">${x||y?`<pane ${x?`xSplit="${x}"`:''} ${y?`ySplit="${y}"`:''} topLeftCell="${excelColumnName(x)}${y+1}" activePane="${active}" state="frozen"/>`:''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="28"/><cols>${sheet.widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"${sheet.hiddenColumns?.includes(i)?' hidden="1"':''}/>`).join('')}</cols><sheetData>${rows}</sheetData>${sheet.filterRow&&!sheet.table?`<autoFilter ref="A${sheet.filterRow}:${end}${sheet.filterEndRow??sheet.rows.length}"/>`:''}${merges.length?`<mergeCells count="${merges.length}">${merges.join('')}</mergeCells>`:''}${sheet.validations?.length?`<dataValidations count="${sheet.validations.length}">${sheet.validations.map(v=>`<dataValidation type="${xml(v.type)}" operator="${xml(v.operator)}" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" sqref="${xml(v.range)}" promptTitle="${xml(v.promptTitle)}" prompt="${xml(v.prompt)}" errorTitle="${xml(v.errorTitle)}" error="${xml(v.error)}"><formula1>${xml(v.formula1)}</formula1><formula2>${xml(v.formula2)}</formula2></dataValidation>`).join('')}</dataValidations>`:''}<printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="${sheet.fitToHeight ?? 0}"/>${sheet.table?'<tableParts count="1"><tablePart r:id="rId1"/></tableParts>':''}</worksheet>`;
  if(sheet.table){
   const {name,headerRow,endRow}=sheet.table, id=index+1;
   const headers=sheet.rows[headerRow-1].values;
   const ref=`A${headerRow}:${excelColumnName(headers.length-1)}${endRow}`;
   files[`xl/tables/table${id}.xml`]=declaration+`<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${id}" name="${xml(name)}" displayName="${xml(name)}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${headers.length}">${headers.map((header,i)=>`<tableColumn id="${i+1}" name="${xml(header)}"/>`).join('')}</tableColumns></table>`;
   files[`xl/worksheets/_rels/sheet${id}.xml.rels`]=declaration+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${id}.xml"/></Relationships>`;
   files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>',`<Override PartName="/xl/tables/table${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`);
  }
  if(index)files['[Content_Types].xml']=files['[Content_Types].xml'].replace('</Types>',`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
 }
 return zip(files);
}
