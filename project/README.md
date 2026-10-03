# VING Warroom ออนไลน์

## ปฏิทิน Event และ Set up / เก็บกลับ

หน้า `/events` เลือก “Timeline Event” หรือ “Set up & เก็บกลับ” ได้ทั้งปฏิทินและรายการ โดย Timeline Event ใช้ข้อมูลเดิมจากรายงาน Event และงานที่ Trade / CEO อนุมัติครบ ส่วน Set up & เก็บกลับอ้างอิง [ชีต Set up หน้าร้าน/เก็บกลับ](https://docs.google.com/spreadsheets/d/1iRZDTA6gbkCGOH-bVGumf4R7N_PjlzWdo14vXs2t1fU/edit?gid=1732890767#gid=1732890767) โดยอ่าน A/B/K/L/M/O/P เท่านั้น ไม่อ่านคอลัมน์ชื่อทีมงานหรือข้อมูลติดต่อ

Timeline คงช่วงวันจัดงาน การรวมงานข้ามเดือน การตัดงานยกเลิก และการรวมรายการซ้ำจากแหล่งเดิม ไม่ใช้ชีต Set up แทนรายงาน; Set up ใช้ K/L; เก็บกลับอิง O เฉพาะเมื่อ P ระบุเวลาเก็บกลับ และมีป้ายอธิบายว่าไม่มีคอลัมน์วันเก็บกลับแยก ไม่ใช้รายงานยอดขายหรือวันอนุมัติมาแทนวันที่ในชีต รายการที่ไม่มีวันหรือเวลาครบแสดงรอยืนยัน ข้อมูลยอดขายและรายงานเดิมใช้แหล่งเดิม ลิงก์ชีต เวลาที่โหลด และข้อผิดพลาดของชีตแสดงเฉพาะมุมมอง Set up & เก็บกลับ

`GET /api/events/schedule` ต้องเข้าสู่ระบบ อ่านต้นทางใหม่ทุกครั้ง หน้าเว็บเรียกเมื่อเปิดหน้า ทุก 15 วินาทีที่แท็บแสดง และเมื่อกลับมาที่แท็บ หากต้นทางขัดข้องแสดงข้อมูลสำเร็จล่าสุดพร้อมคำเตือนและเวลาที่โหลดได้ บันทึก fallback เฉพาะข้อมูลกำหนดการที่ผ่านการคัดกรองแล้วใน R2; ชีตว่างที่โหลดสำเร็จต้องล้างรายการเก่า ไม่มีงานอัปเดตเบื้องหลังเมื่อปิดหน้า

ตรวจด้วย `node --test event-logistics.test.mjs event-schedule.test.mjs event-directory.test.mjs` หลัง build

## ภาพรวมยอดขายเสนอ Event

หน้า `/event-proposals` แยกยอดขายพื้นที่ใหม่และพื้นที่ที่มีข้อมูล โดยจัดกลุ่มจากข้อมูลเดิมก่อนแปลงตัวเลขสำหรับแสดงผล พื้นที่ใหม่ใช้ยอดตั้งเป้าหรือกรณีที่เสนอ พื้นที่ที่มีข้อมูลใช้ยอดคาดการณ์ กล่อง “เป้าหมายรวมทั้งหมด” รวม `calculation.target.sales` หรือ `row.target` ของทั้งสองกลุ่ม โดยปัดขึ้นเป็นบาทต่อหนึ่งงานเช่นเดียวกับตาราง ไม่ใช้ยอดคาดการณ์แทนเป้าหมายที่ขาด แต่ละกล่องแสดงจำนวนงานที่มีตัวเลข ค่าศูนย์ยังนับเป็นข้อมูล และช่องที่ไม่มีข้อมูลคงเป็น “—” ทุกกล่องรวมทุกสถานะและปรับตามเดือนที่เลือกเหมือนเดิม

ตรวจด้วย `node --test proposal-outlook.test.mjs event-proposals.test.mjs proposal-month-filter.test.mjs`

## แจ้งกลับเมื่ออ่านแล้ว

กด “อ่านแล้ว” ในกระดิ่งเพื่อบันทึกและแจ้งกลับไปยังบัญชีผู้ส่งคำขอ ผู้สร้างรายการ และ CEO / Trade ที่เกี่ยวข้อง โดยเว้นบัญชีผู้อ่าน แจ้งเตือนใหม่แสดงบทบาทผู้อ่านและเวลาอ่าน แยกสถานะ `acknowledged` จากการอนุมัติ ไม่มีการเปลี่ยนผลพิจารณา Event หรือสัญญา และไม่มีการเพิ่มชื่อบุคคลในข้อความรับทราบ

รายการเดิมที่ไม่มีบัญชีผู้ขออนุมัติจะใช้บัญชีทีมผู้ส่งคำขอที่ตั้งค่าไว้เป็นผู้รับแทน การอ่านซ้ำจากบัญชีเดิมบนหลายอุปกรณ์สร้างแจ้งกลับเพียงครั้งเดียวต่อเวอร์ชันรายการ การอ่านหรือลบแจ้งกลับไม่สร้างการแจ้งเตือนวนซ้ำ สถานะอ่าน/ลบในกล่องแจ้งเตือนยังแยกตามเบราว์เซอร์เดิม

เก็บแจ้งกลับและคิวมือถือผ่าน `web_changes` ใน transaction เดียวกับสถานะอ่าน ใช้บัญชีจาก session ฝั่งเซิร์ฟเวอร์เพื่อเลือกผู้รับและกรองรายการ/จำนวนยังไม่อ่าน/สิทธิ์อ่านและลบ/การส่งมือถือ ไม่มีการเปลี่ยน schema ผู้รับที่เปิดแจ้งเตือนบนอุปกรณ์จะได้รับ Web Push ผ่านระบบเดิม ข้อความจอล็อกแสดงเฉพาะ “มีผู้เกี่ยวข้องอ่านรายการแล้ว”

ตรวจด้วย `node --test notification-receipts.test.mjs notifications.test.mjs mobile-push.test.mjs` หลัง build ใช้ข้อมูลทดสอบแยกจากข้อมูลจริง การทดสอบคิวไม่แทนการยืนยันรับจริงบนโทรศัพท์

## แจ้งเตือนบน iPhone

ทุกบัญชีที่เปิดผ่าน Home Screen web app บน iPhone ต้องอนุญาตและลงทะเบียนรับแจ้งเตือนให้สำเร็จก่อนใช้งาน หน้าบังคับไม่มีปุ่มข้ามและปิดด้วย Escape ไม่ได้; ยังออกจากระบบได้ ตรวจทั้งสิทธิ์แจ้งเตือน อุปกรณ์ที่สมัคร และการบันทึกฝั่งเซิร์ฟเวอร์ คนที่สมัครแล้วเข้าได้อัตโนมัติ หากปฏิเสธ แสดงขั้นตอนการตั้งค่าและปุ่มตรวจสอบอีกครั้ง ตรวจซ้ำเมื่อกลับเข้าแอปและเปลี่ยนบัญชี ไม่บังคับ Safari แบบแท็บ, Android, iPad หรือคอมพิวเตอร์ เป็นข้อกำหนดของหน้าใช้งานตามโหมดอุปกรณ์ ไม่ใช่ตัวแทนการตรวจสิทธิ์ API ฝั่งเซิร์ฟเวอร์

เปิดเว็บใน Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม (เปิดเป็นเว็บแอป) → เปิด VING Warroom จากไอคอน → เข้าสู่ระบบ → กระดิ่ง → เปิดแจ้งเตือนบนอุปกรณ์นี้ → อนุญาต รองรับ iOS 16.4 ขึ้นไป มีปุ่มทดสอบและปิดเฉพาะอุปกรณ์

ส่งการเปลี่ยนแปลงที่อยู่ในกระดิ่งเดิม (คำขอ/แก้ไข/ลบ/ผลพิจารณา Event และสัญญา) หลังบันทึกสำเร็จ โดยใช้ Web Push แบบเข้ารหัสและไม่ต้องเปิดหน้าเว็บผู้รับค้างไว้ ผู้ชมรับเฉพาะรายการที่อนุมัติแล้ว ข้อความบนจอล็อกเป็นข้อความประเภทงาน ไม่มีชื่อบุคคลหรือรายละเอียดรายการ แตะกลับเข้ารายการแจ้งเตือนในเว็บภายใต้การเข้าสู่ระบบเดิม

สมัครรับเฉพาะเหตุการณ์หลังเปิดใช้ ไม่ส่งประวัติเก่า ซิงก์สถานะเดิมไม่ส่งซ้ำ ปิดเมื่อออกจากระบบ/เปลี่ยนบัญชีบนอุปกรณ์ หรือเปลี่ยนรหัสผ่านบัญชี การรับแจ้งเตือนมีอายุ 180 วันและต่ออายุเมื่อเปิดเว็บด้วยบัญชีเดิม ส่งซ้ำเมื่อผู้ให้บริการขัดข้องชั่วคราวภายในงานเบื้องหลัง; งานที่ยังไม่สำเร็จรอคำขอแจ้งเตือน/การบันทึกครั้งต่อไป ไม่มีการรับประกันเวลาเมื่ออุปกรณ์ออฟไลน์หรือเปิด Focus

ตั้ง `WEB_PUSH_PRIVATE_JWK` เป็น Sites secret, `WEB_PUSH_PUBLIC_KEY` และ `WEB_PUSH_SUBJECT` เป็น runtime settings คู่กุญแจสร้างครั้งเดียว เก็บฝั่งเซิร์ฟเวอร์ ห้ามสลับคู่โดยไม่ให้ผู้ใช้เปิดรับใหม่ Migration 0009 เพิ่มตารางอุปกรณ์และคิวพร้อม triggers ใน transaction เดียวกับ web_changes; service worker ไม่ cache หน้ารายงาน ทดสอบ `node --test mobile-push.test.mjs notifications.test.mjs` หลัง build การทดสอบระบบไม่แทนการกดทดสอบรับจริงบน iPhone

## ตารางรายการเสนอ Event

รายการแยกเป็น “พื้นที่ที่มีข้อมูลแล้ว” และ “พื้นที่ใหม่” ตามโหมดที่เสนอหรือป้ายพื้นที่ใหม่ในชีต ทุกตัวเลขแสดงลูกน้ำ ไม่มีทศนิยม โดยไม่เปลี่ยนค่าที่บันทึก ยอดขายตั้งเป้าและคุ้มทุนปัดขึ้นเป็นบาท ตารางพื้นที่ใหม่แสดงยอดตั้งเป้าและกำไร/ROI ของ target snapshot เดียวกัน ไม่เอากำไรจากยอดประมาณการเดิมมาปะปน คอลัมน์คุ้มทุนอ่านจาก calculation.breakEven ที่บันทึกไว้; รายการชีตที่ไม่มีรายละเอียดต้นทุนแสดง — ไม่อนุมานจากยอดขายกับกำไร ตัวเลือกคอลัมน์เดิมย้ายไป v3 และเพิ่มเป้าหมายกับคุ้มทุน การรีเฟรชและสถานะอนุมัติครอบคลุมทั้งสองตาราง

## เปิดคาดการณ์จากรายการเสนอ Event

คลิกชื่อ Event หรือสถานที่ใน `/event-proposals` เพื่อเปิด `/event-predict?proposal=...` ของรายการนั้นโดยใช้รหัสเฉพาะงาน หน้า CEO review แสดงยอดขาย กำไร Margin, ROI, จุดคุ้มทุน และงบกำไรขาดทุนพร้อม % ของยอดขาย เลือก Downside / Base case / Upside เพื่อดูงบแยกกรณีได้

คำขอผ่านเว็บใช้ snapshot ที่บันทึกตอนเสนอ ไม่คำนวณทับด้วยประวัติใหม่ คำขอเก่าที่เทียบกรณีต่ำ/สูงกับเป้าหมายมีป้ายกำกับ รายการชีตแสดงเฉพาะตัวเลขที่มี ต้นทุนรวมอนุมานจากยอดขาย − กำไร ไม่มีการสร้างรายละเอียดต้นทุนหรือสมมติฐานแทนข้อมูลที่ขาด ลิงก์ที่ถูกลบแสดงไม่พบรายการ ทั้งผู้ชมและผู้จัดการอ่านได้ภายใต้ session เดิม

ตรวจ `node --test event-review.test.mjs event-permissions.test.mjs event-proposals.test.mjs` หลัง build

## คาดการณ์ Event

เมนู Event → คาดการณ์ Event (`/event-predict`) อ่าน 2 ชีต Event ปี 2569 รวมชื่อสถานที่โดยแยกสาขาออกจากกัน Base ใช้ยอดหลังส่วนลดรวม ÷ จำนวนวันขายรวมของทุกงานที่สิ้นสุดแล้วในสถานที่เดียวกัน รวมทั้งค่าเช่าและ GP งานชื่อซ้ำ/วันที่ผิดแยกออก ต้นทุนตั้งต้นใช้ประวัติรูปแบบพื้นที่เดียวกัน ชื่อที่เป็นเพียงชื่องานและไม่ระบุสถานที่ไม่ถูกแสดงเป็นสถานที่สมมติ

เป้าเริ่มต้นใช้คอลัมน์เป้าของงานล่าสุดที่สิ้นสุดแล้วในรูปแบบเดียวกัน ผู้ใช้แก้เองได้ หากไม่มีเป้าเดิม ใช้ยอดที่ทำให้ ROI 40% เมื่อข้อมูลต้นทุนครบ ROI = กำไร / ต้นทุนรวม ไม่ใช่อัตรากำไรต่อยอดขาย สูตรเป้า = ceil(1.4F / (1−1.4v)) โดย F รวมค่าเช่า PC ขนส่งและอื่น ๆ และ v รวม COGS% กับ GP% (ถ้ามี) ไม่มีเป้าอัตโนมัติหาก F=0 หรือส่วนหารไม่เป็นบวก เป้าเดิมต้องยืนยันว่าเป็นฐานหลังส่วนลด

แสดง 3 กรณี: ต่ำกว่าเป้า, Base case, สูงกว่าเป้า ต่ำ/สูงเริ่มที่ 20% เทียบเป้าหมายและปรับได้ Base ยังคงแยกจากเป้า พื้นที่ใหม่กรอกต้นทุนทั้งหมด แล้วกดคาดการณ์เพื่อหายอดขายคุ้มทุนและยอดขายเป้ากำไร ROI 40% (กำไร ÷ ต้นทุนรวม) พร้อมยอดเฉลี่ยต่อวัน โดยไม่ต้องกรอกยอดขายประมาณการ เป้าปัดขึ้นเป็นบาท เมื่อแก้ต้นทุนต้องกดคำนวณใหม่ คำขออนุมัติใช้ salesMode=cost-target และเซิร์ฟเวอร์คำนวณเป้าจากต้นทุนซ้ำ คำขอ manual เดิมยังคงวิธีคำนวณและ snapshot เดิม ไม่มีการตีค่าว่างเป็น 0

ปุ่มขออนุมัติ POST `/api/event-requests` ภายใต้ session เดิมและตรวจ Origin/ขนาด/ชนิดข้อมูล ฝั่งเซิร์ฟเวอร์คำนวณซ้ำ ตรวจประวัติตรงกับหน้าที่ตรวจแล้ว และบันทึก snapshot ใน D1 `DB.event_requests` ด้วย UUID ป้องกันส่งซ้ำ แล้วเปิด `/event-proposals?request=...` รายการใหม่แสดงรออนุมัติ Trade/CEO ร่วมกับชีตเดิม ไม่แก้ Google Sheets และไม่มีการแจ้งข้อความหาผู้อื่น การอนุมัติจริงยังต้องดำเนินการโดยผู้รับผิดชอบ

API เก็บประวัติอ่านอย่างเดียวใน R2 `event-predict-v2.json` และสำรองเฉพาะฟิลด์การเงิน ไม่มีชื่อผู้รับผิดชอบ/ข้อมูลส่วนบุคคล เช็กชีตเมื่อเปิดหน้า (cache 5 นาที) บอกสถานะข้อมูลเมื่ออ่านต้นทางไม่ได้ แต่ไม่มีปุ่มเชื่อมต่ออีกครั้ง

ตรวจ `node --test event-predict.test.mjs event-proposals.test.mjs` และ `node realtime.test.mjs` หลัง build; local preview ใช้ SQLite เฉพาะใน `.sites-runtime` ตาม migration เดียวกับ D1

Sales Report เลือกวันที่ได้ครบปฏิทินถึงสิ้นเดือน รวมกุมภาพันธ์ปีอธิกสุรทิน ตัวเลือก “ล่าสุด — อัตโนมัติ” ติดตามวันใหม่ที่ได้รับ ส่วน “ปิดเดือน” แสดงยอดจริงสะสมที่นำเข้า พร้อมสถานะรอข้อมูลครบเดือนจนรายงานถึงวันสุดท้าย ไม่มีการเติมยอดให้วันอนาคต วันที่เลือกเจาะจงและมุมมองปิดเดือนคงอยู่เมื่อเว็บรับข้อมูลใหม่

Sales Report รองรับการอ่าน Excel โดยตรงผ่าน Microsoft Graph แล้ว แต่ยังต้องตั้งค่าการเชื่อมต่อครั้งแรกตาม `automation/MICROSOFT-ONLINE-SETUP.md` และตรวจการนำเข้าจากไฟล์จริงก่อนถือว่าเปิดใช้งาน ผู้ดูแลเปิด `/sales-online` เพื่อเชื่อม Microsoft หลังตั้งค่าแอปแล้ว เว็บตรวจต้นทางทุก 60 วินาทีขณะเปิดและแสดงผลผ่านการรีเฟรชเดิมทุก 15 วินาที รองรับการแก้ยอดวันเดิม/เดือนก่อนใน workbook เดิม โดยไม่ดาวน์โหลด XLSX/CSV เก็บยอดที่อ่านสำเร็จล่าสุดหากต้นทางขัดข้อง พร้อมสถานะและเวลาอ่านจริง งาน Codex `sales-report-10-00` เดิมยังเป็นทางสำรองเวลา 18:00 น. และยังพึ่ง Mac, Codex และ session Microsoft; ยังไม่ปิดจนกว่าการเชื่อมต่อใหม่จะผ่านการตรวจจริง

## งบกำไร–ขาดทุน

แท็บ `/profit-loss` อ่านรายละเอียดจากลิงก์สรุปต้นทุนห้างโดยตรง: Consign, Stand alone, Event เก็บเงินเอง และ Event จ่าย GP เลือกเดือน/รวมปี ช่องทาง และ ACT/FCT ได้ ป้าย FCT ของ Stand alone อ่านจากหัวเดือนจริงในชีต ส่วน Consign อ่านจากแต่ละแถว บ้านและสวนที่อยู่ใน Event เก็บเงินเองไม่นับซ้ำ

ยอดสุทธิและต้นทุนสินค้าใช้ตัวเลขต้นทาง ค่าใช้จ่ายรวมจากรายการแยกหมวด กำไรคำนวณโดยหัก COGS ครั้งเดียว ไม่ใช้สูตรรวมปีหรือ subtotal ที่ข้ามแถว แสดงส่วนต่างกำไรต้นทางเกิน 1 บาท และต้นทุนที่ยังว่าง แถวมีต้นทุนแต่รอยอดขายยังรวมในค่าใช้จ่ายและระงับกำไรรวม; template ที่ยอด/ต้นทุนยังไม่บันทึกไม่ถูกตีความเป็นยอดจริงศูนย์ ขอบเขตคือกำไรระดับสาขาก่อนส่วนกลางและภาษีเงินได้

ตัวอ่านเก็บเฉพาะฟิลด์การเงิน ชื่อสาขา/งาน และรหัสสาขา แยก cache `profit-loss.json` ใน R2 จาก snapshot อื่น ไม่แก้ Google Sheet และไม่ต้องพึ่ง Mac sync. ตรวจต้นทางทุก 5 นาทีเมื่อมีการเปิดหน้าเว็บ; เมื่ออ่านไม่ได้ใช้ข้อมูลที่ดึงสำเร็จล่าสุดพร้อมเวลาและสถานะเตือน ข้อมูลสำรองอยู่ใน `profit-loss.snapshot.json`.

ตรวจด้วย `node --test profit-loss.test.mjs` และ `node realtime.test.mjs` หลัง build. ชุด benchmark ตรวจเทียบรายการใน workbook ออนไลน์วันที่ 17 ก.ย. 2569 แยกจากยอดสรุปต้นทาง

เว็บสาธารณะแบบดูอย่างเดียว ใช้ข้อมูลที่ผ่านการกรองจากระบบในเครื่อง

Sales Report แยกเวลาซิงก์เว็บออกจากเวลาอ่านรายงาน แถบสถานะแสดงวันล่าสุดที่มียอดจริงและเวลานำเข้าต้นทาง หากยังไม่มีการส่งข้อมูลจาก Excel ออนไลน์จะแสดง “ยังไม่ได้เชื่อม Excel ออนไลน์” การซิงก์ snapshot สำเร็จไม่ถือว่าอ่าน Excel สำเร็จ และการรับข้อมูลจากคลาวด์ไม่ได้ยืนยันว่ามีตารางเวลาทำงานแล้ว ตรวจด้วย `node sales-freshness.test.mjs`

- บริการ `com.ving.warroom-sync` เริ่มเมื่อเข้าสู่ระบบ macOS และส่งข้อมูลทุก 30 วินาที ขณะเครื่องเปิดและออนไลน์
- หน้าเว็บตรวจข้อมูลทุก 15 วินาที เมื่อแท็บเปิดอยู่ หากเปิดหน้าต่างรายละเอียดหรือกำลังใช้ช่องกรอง จะเลื่อนการวาดหน้าใหม่เพื่อไม่ขัดจังหวะ
- ถ้าต้นทางหยุดซิงก์เกิน 2 นาที จะแสดงสถานะพร้อมเวลาข้อมูลล่าสุด
- Google Sheet ที่ตอบช้าหรือขัดข้องจะใช้ข้อมูลสำรอง พร้อมวันที่ดึงสำเร็จล่าสุด หากเฉพาะเดือนย้อนหลังส่งข้อมูลว่าง ระบบยังอัปเดตเดือนปัจจุบันและแสดงเดือนที่ขาดว่า “ข้อมูลไม่ครบ” พร้อมคำเตือนยอดรวมปี
- ข้อมูลที่ได้รับเก็บเป็น snapshot ใน Sites R2 การเปลี่ยนข้อมูลไม่ต้องเผยแพร่โค้ดใหม่
- `.sync-secret` เป็นกุญแจสำหรับส่งข้อมูล เก็บเฉพาะเครื่องนี้ ห้ามแชร์หรือเพิ่มเข้า Git
- `sync.log` และ `.sync-state.json` ใช้ตรวจสถานะในเครื่อง
- ปิดการซิงก์ได้ด้วย `launchctl bootout gui/$(id -u)/com.ving.warroom-sync`
- เปิดอีกครั้งด้วย `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ving.warroom-sync.plist`

การแก้โค้ด: รัน `node build.mjs` และ `node realtime.test.mjs` ก่อนเผยแพร่ผ่าน Sites เดิม
ไฟล์ `export.mjs`, `finalize.mjs`, `enable-realtime.mjs` เป็นขั้นตอนย้ายระบบครั้งแรก ไม่ควรรันซ้ำทับเวอร์ชันปัจจุบัน

## ตารางรายสาขา

คาดการณ์สาขา = ยอดสะสมเดือนปัจจุบัน ÷ เลขวันที่ล่าสุดที่มีข้อมูลรายวันของกลุ่มสาขาประจำในเดือนเดียวกัน (แยกจากวันล่าสุดของ Event) × จำนวนวันในเดือนที่เลือก ใช้วันอัปเดตยอดขายแบบรวมวันนั้น เช่น ถึง 17 ก.ย. หาร 17 ไม่ใช้วันนี้ − 1 หรือเวลาซิงก์ การเลือกวันรายงานเปลี่ยนยอดรายวันแต่ไม่เปลี่ยนฐานยอดสะสม สูตรใช้ทั้งตาราง สรุปช่องทาง และเทียบปีก่อน เดือนอนาคตใช้ฐานเดือนปัจจุบันคูณวันในเดือนเป้าหมาย วันที่ 1 คำนวณได้เมื่อมียอดถึงวันที่ 1; วันที่ขาด/ผิด/อยู่อนาคตไม่สร้างคาดการณ์ Event ยังคำนวณตามวันจัดงานเดิม

เปิดรายงานที่เดือนล่าสุดและแสดงทุกคอลัมน์ ช่องติ๊กใช้ซ่อน/แสดงข้อมูลโดยชื่อสาขาคงอยู่เสมอ ยอดรายวันแสดงครบเดือน สาขาที่เคยมียอดขายมากกว่า 0 แล้ว (รวมหลักฐานจากเดือนก่อน) ให้นับวันว่างต่อจากนั้นเป็นยอด 0 ถึงวันล่าสุดในรายงาน ไม่รวมวันอนาคตหรือวันที่ยังไม่ถึงรอบรายงาน วันก่อนเริ่มขายยังแสดง — ยอดวันที่เลือกและจำนวนวันที่ขายไม่ได้ใช้กติกาเดียวกัน มุมมองทั้งปีแยกตารางรายวันแต่ละเดือน การซิงก์อัตโนมัติรักษาเดือนและช่องที่ผู้ใช้เลือกไว้

Event ใน Sales Report ใช้ส่วนของรายงานก่อนชื่อประเภท: แถวในส่วน Event นับเป็น Event แม้ต้นทางระบุ CDS/RBS และแถวรหัส VA ในส่วนร้านประจำนับเป็น Stand alone รวม Pop up Store โดยยังใช้ข้อยกเว้นสาขาที่เจ้าของยืนยันก่อนจัดหมวด ส่วนแถวที่ไม่มีข้อมูลตำแหน่งรายงานจึงใช้ชื่อประเภทเดิม คาดการณ์จากผลรวมยอดรายวันในช่วงงาน หารจำนวนวันเปิดขายที่ผ่านไป คูณวันเปิดขายทั้งหมดเฉพาะส่วนที่อยู่ในเดือนที่เลือก รวมวันเปิดขายที่ยอดเป็น 0 ด้วย ช่วงขายที่จบแล้วแสดงยอดจริง ไม่คาดการณ์ต่อถึงสิ้นเดือนและไม่ยก Event ไปเดือนอนาคตอัตโนมัติ วันที่ใช้มาจากชื่อแถวรายงานหรือ catalog ที่จับคู่ได้รายการเดียว หากช่วงวันไม่ชัดเจน/กำกวม แสดงรอวันเปิดขายเฉพาะคาดการณ์ราย Event ในตาราง ตัวเลขสะสมต้นฉบับไม่ถูกเขียนทับ

ตรวจสูตรด้วย `node --test sales-rules.test.mjs daily-sales-summary.test.mjs daily-highlights.test.mjs`

## Event

- หน้า “ภาพรวม Event” ใช้การ์ดสรุป กราฟแท่งรายเดือนที่สลับยอดขาย/จำนวนงาน กราฟวงแหวนสัดส่วน และกราฟยอดขาย 5 อันดับ โดยใช้ชุดข้อมูลและสูตรเดิม
- ยอดศูนย์แยกจากเดือนที่ไม่มีข้อมูล เดือนของวันรายงานที่ยังไม่ครบเดือนใช้สีอ่อน กราฟปี 2568 ชี้แจงว่าจำนวนรายเดือนอาจนับงานข้ามเดือนซ้ำ แต่จำนวนรวมปีตัดชื่อซ้ำแล้ว
- ตัวเลขรายเดือน รายละเอียดอันดับ จำนวนวัน/ยอดต่อวัน และแหล่งข้อมูลเปิดดูได้ในส่วนพับ รายชื่อครบทุกงานยังกรองเดือนได้ การอัปเดตอัตโนมัติรักษาปี เดือน ชนิดกราฟ ส่วนรายละเอียดที่เปิด และตำแหน่งเลื่อนรายชื่อ
- ตรวจกราฟและพฤติกรรมเดิมด้วย `node --test event-charts.test.mjs events.test.mjs event-months.test.mjs event-metrics.test.mjs`

- เมนู Event มี “ภาพรวม Event” และ “เสนอ Event” (`/event-proposals`)
- เสนอ Event อ่านชีต `เสนอ Event` (gid 560515462) โดยตรงจากคลาวด์ทุก 15 วินาทีเมื่อมีผู้เปิดหน้า ไม่ต้องเปิด Mac; หน้าเว็บตรวจทุก 15 วินาทีและเมื่อกลับเข้าแท็บ ระยะเห็นการเปลี่ยนแปลงปกติประมาณ 15–30 วินาที บวกเวลาประมวลผลของ Google Sheets
- อ่าน CSV ช่วง B:AA โดยจับคู่ตามชื่อหัวคอลัมน์ที่อนุญาต เพื่อคงทั้งตัวเลขและข้อความ เช่น “พื้นที่ใหม่” และ `?` โดยไม่อ่านคอลัมน์ OWNER ไม่คำนวณคาดการณ์หรือสถานะอนุมัติขึ้นเอง ช่องอนุมัติว่างแสดง “ยังไม่ระบุ”
- เก็บข้อมูลล่าสุดใน R2 และแสดงเวลา/สถานะเมื่อเชื่อมต่อไม่ได้ หัวตารางผิดรูปแบบไม่ทับข้อมูลล่าสุด ชีตว่างที่มีหัวตารางถูกต้องล้างรายการได้ อัปเดตไม่รบกวนตำแหน่งเลื่อนตาราง
- ตรวจการอ่าน การอัปเดต การเชื่อมต่อขัดข้อง และการกลับมาออนไลน์ด้วย `node --test event-proposals.test.mjs`
- หน้าเสนอ Event มี Dashboard จำนวนงาน อนุมัติครบทั้ง Trade/CEO รออนุมัติครบ และไม่อนุมัติอย่างน้อยหนึ่งฝ่าย พร้อมยอดคาดการณ์รวมเฉพาะช่องตัวเลขและจำนวนงานที่มีข้อมูล ไม่แทนข้อความหรือช่องว่างด้วยศูนย์
- ปุ่ม “เลือกข้อมูลที่แสดง” มุมขวาบนของตารางเลือกคอลัมน์ได้ โดยสถานที่แสดงเสมอ ค่าเริ่มต้นแสดง 8 คอลัมน์และวาง Trade/CEO ด้านหน้า จำค่าเฉพาะเบราว์เซอร์เดิม อัปเดตข้อมูลโดยรักษาคอลัมน์ เมนูที่เปิด โฟกัส และตำแหน่งเลื่อน

- Event เป็นแท็บหลัก เลือกปี 2568/2569 ได้ และคงปีเดิมเมื่อข้อมูลรีเฟรช
- ปี 2568 ใช้ชื่อ จำนวน และยอดจาก `Event 2025` ในสรุปต้นทุนห้าง 2569
- ปี 2569 ใช้รายชื่อไม่ซ้ำจาก `Event เก็บเงินเอง` + `Event จ่าย GP` ในไฟล์เดียวกัน จำนวนงานรวมอนาคตด้วย
- ตารางรายชื่อปี 2569 มีคอลัมน์เดือนที่จัดและตัวกรองเดือนที่หัวตาราง งานข้ามเดือนแสดงในทุกเดือนที่จัดภายในปี 2569; วันที่ไม่ชัดเจนใช้เดือนที่ระบุในชีตต้นทาง ตัวกรองมีผลเฉพาะรายชื่อและคงค่าผ่าน URL/การรีเฟรชข้อมูล ยอดขายยังเป็นยอดรวมของงาน ตรวจด้วย `node --test event-months.test.mjs`
- ยอดปี 2569 รวมยอดรายวันของกลุ่ม Event ใน Sales Report 2026 PC VING ถึงวันรายงาน ใช้ยอดสะสมเฉพาะแถวที่ไม่มีค่ารายวันเลย กลุ่ม Event อยู่ระหว่างสาขาห้างและ Standalone ตามรหัสสาขา จึงรองรับแถว Event ที่ประเภทเป็น CDS/RBS
- จับคู่ชื่อสถานที่ ประเภท และช่วงวันที่ ถ้าหลายงานตรงกันหรือวันที่ผิด ให้คงยอดเป็นรายการรอจับคู่ ยอดดังกล่าวรวมในยอดรวมแต่ไม่เพิ่มจำนวน Event และไม่ใส่ยอดต้นทุนแทน
- `event-catalog.mjs` อ่านชีตแบบ read-only และเก็บ cache 5 นาที โดยตรวจทั้งสองชีตต้องมีรายการก่อนแทนข้อมูลเก่า `events-data.mjs` คำนวณใหม่หลังนำรายงานคลาวด์มารวม จึงไม่ค้างยอดที่ซิงก์จาก Mac
- หลังอนุมัติเผยแพร่ ให้เผยแพร่ Worker รุ่นนี้และเริ่มบริการ `com.ving.warroom-sync` ใหม่เพื่อโหลดตัวอ่านรายชื่อใหม่ จากนั้นรัน `sync.mjs --once` ตรวจว่าซิงก์สำเร็จ ห้ามส่ง catalog ดิบเข้าเว็บรุ่นเก่า
- ตรวจด้วย `node --test events.test.mjs` (มี assertion ชุดข้อมูล ณ 16 ก.ย. 2569) และ `node realtime.test.mjs`

## สรุป Sales Report

ยอดคาดการณ์รวมและสรุปช่องทางใช้คาดการณ์สาขา + ยอดจริงสะสม Event โดยไม่รอช่วงวันขายของ Event ส่วนคาดการณ์ราย Event ในตารางยังใช้วันเปิดขายตามเดิม ยอดจริงปีก่อนรวมทุกช่องทาง รวม Event และเทียบกับเดือนเดียวกันที่มีข้อมูลครบ ส่วนต่างบาทและ % เทียบยอดคาดการณ์สาขา / ยอดจริง Event กับยอดจริงเต็มเดือนปีก่อน; เดือนย้อนหลังและมุมมองรายปีใช้ยอดจริง โดยรายปีเทียบเฉพาะเดือนเดียวกันที่นำเข้า หากไม่มีข้อมูลครบจะแสดงเหตุผลแทน หากฐานเป็น 0 หรือติดลบไม่คำนวณ %

จำนวนสาขาโต/ตกยังเทียบเฉพาะสาขาที่จับคู่ได้ตามคาดการณ์ปิดเดือน สาขาที่ไม่มีรายการปีก่อนจับคู่ได้จัดเป็น “สาขาเปิดใหม่” ตามที่เจ้าของกำหนด โดยไม่สร้างวันเปิดหรือยอดปีก่อน Event เทียบเฉพาะยอดรวมช่องทาง รายละเอียดวิธีเทียบอยู่ในหัวข้อพับได้

ตรวจด้วย `node --test sales-summary-comparison.test.mjs sales-yoy.test.mjs sales-rules.test.mjs daily-sales-summary.test.mjs`

## แถวสาขาและส่วน Event ที่ใช้ชื่อเดียวกัน

Sales Report แยกแถวส่วน Event (ระหว่างรหัสเคาน์เตอร์ห้างสุดท้ายและรหัส Stand alone แรก) ออกจากเคาน์เตอร์ที่ชื่อเหมือนกัน โดยรักษาประเภทช่องทางตามต้นทาง แสดงส่วนของรายงานและรหัสใต้ชื่อเสมอ ตัวอย่างลาดพร้าวจะไม่ให้แถว Event วันที่ 1–2 ก.ย. ทับยอดเคาน์เตอร์วันที่ 3 เป็นต้นไป

ข้อยกเว้นที่เจ้าของยืนยันใช้ก่อนตำแหน่งแถว: CM (เชียงใหม่) = RBS VC-006 โรบินสันเชียงใหม่, Fashion Island = CDS VC-028 แฟชั่นไอซ์แลนด์, RAMA 2 = CDS VC-010 พระราม2 และสนามกีฬาเทพหัสดิน VA-007 = Stand alone (ต้นทางระบุ Flagship) ใช้การจับคู่นี้ทุกเดือนรวมปีก่อน แถวชื่อย่อไม่มีรหัสที่ยอดสะสมเป็น 0 และรายวันว่างทุกวันจะรวมเข้ากับแถวรหัสหลักเมื่อพบคู่เดียว โดยคงยอดและเป้าหมายจากแถวหลัก ไม่บวกเป้าหมายแถวว่าง รายการมีรหัสกิจกรรม เช่น Sneaker Showcase / Sport World Cup หรือ Kelly Fashion Island ไม่เข้ากฎนี้ และสาขาที่เจ้าของยืนยันไม่ถูกนำไปรวมยอด Event

หากหลายแถวภายในส่วนเดียวกันยังมีชื่อ/ประเภท/รหัสเหมือนกัน จะบวกยอดรายวันและยอดสะสมโดยไม่ให้ช่องว่างทับยอดเดิม วันขายดีที่สุดและคาดการณ์คำนวณจากยอดที่รวมแล้ว การเทียบปีก่อนยังคงเตือนรายการซ้ำเมื่อจับคู่ไม่ได้แน่ชัด

ตรวจด้วย `node --test branch-sales-values.test.mjs column-filters.test.mjs sales-yoy.test.mjs sales-summary-comparison.test.mjs`

## เมนูหัวคอลัมน์ Sales Report

ทุกคอลัมน์รวมยอดรายวันมีปุ่มเปิดเมนูค้นหา เลือกหลายค่าที่ต้องการแสดง และเรียงสองทิศทาง ตัวกรองหลายคอลัมน์ทำงานร่วมกันเฉพาะตารางนั้น มีจำนวนผลลัพธ์และปุ่มล้างทั้งหมด ยอดสรุปยังรวมทุกสาขา ค่าที่ไม่มีข้อมูลอยู่ท้ายทั้งสองลำดับ ตัวกรองถูกล้างเมื่อเปลี่ยนปี เดือน วันที่ หรือซ่อนคอลัมน์ที่กรองอยู่ รองรับ Enter เพื่อใช้ตัวกรองและ Escape เพื่อปิดเมนู ตรวจด้วย `node --test column-filters.test.mjs`

## Summary

Summary อ่าน `/api/summary` โดยยอดขายใช้ `loadComparison` และ cache เดียวกับ Daily report เทียบปี ตรวจอัปเดตทุก 5 วินาทีเมื่อเปิดหน้าอยู่และตรวจทันทีเมื่อกลับมาที่แท็บ ยอดรวม 4 ช่องทาง กราฟ และรายวันใช้ข้อมูลสดชุดเดียวกัน แสดงวันที่ข้อมูลและสถานะการเชื่อมต่อ หากขัดข้องคงชุดล่าสุดที่โหลดสำเร็จและรักษาตัวกรองเดิม รายงานสาขาและงบยังอ่าน snapshot / cloud sales และ `profit-loss.json` ที่เว็บเก็บไว้

กล่อง Event แสดงจำนวนกำไร ขาดทุน รอข้อมูล และเท่าทุน (เมื่อมี) ของงานในช่วงที่เลือก จับคู่กับงบเดือนและฐาน ACT/FCT ด้วยรหัสงานหรือสถานที่พร้อมช่วงวันที่และประเภทพื้นที่ ข้อเสนอที่มีเพียงประมาณการ รายการไม่มีงบ จับคู่กำกวม หรือขาดยอดขายสุทธิ/ต้นทุนสินค้า/ค่าใช้จ่ายรวม จัดเป็นรอข้อมูล งานยกเลิกไม่ถูกนับ ตรวจด้วย `node --test summary-realtime.test.mjs summary-web.test.mjs summary-overview.test.mjs summary-approved-events.test.mjs` หลัง build

แท็บเดิมยอดขายห้างเปลี่ยนเป็น Summary ที่ `/summary` และลิงก์ `/sales` เดิมเปิดหน้าสรุปเดียวกัน เลือกปีและเดือนร่วมกันทั้งยอดขาย งบ และปฏิทิน Event พร้อมกราฟทั้งปีและตารางรายเดือน

- ยอดขายใช้แบบจำลองเดียวกับ Sales Report และรวม Event อยู่แล้ว ไม่บวกยอดจาก catalog ซ้ำ
- กำไรใช้ยอดขายสุทธิหักต้นทุนและค่าใช้จ่ายที่บันทึก รวมแถวที่มีต้นทุนแต่ยังรอยอดขาย แสดง ACT/FCT ชัดเจนและเลือกฐานงบได้
- Event ใช้วันเริ่ม–สิ้นสุดเทียบวันปัจจุบันประเทศไทย แยกกำลังจัด กำลังจะจัด จัดแล้วตามกำหนด และรอยืนยันวันที่ งานข้ามเดือนปรากฏในทุกเดือนที่ทับซ้อน
- ตัวกรองคงอยู่เมื่อข้อมูลรีเฟรช และคำนวณสถานะใหม่เมื่อเปลี่ยนวันในประเทศไทย ไม่มีข้อมูลแสดง —
- ตรวจด้วย `node --test summary.test.mjs sales-summary-comparison.test.mjs event-months.test.mjs` และ `node realtime.test.mjs`

## Rebrand

เมนู อื่นๆ → Rebrand (`/rebrand`) อ่านชีต `สาขาที่รีโนเวท2026` (gid 268411880) ช่วง A1:I1000 จาก Google Sheets โดยตรง ตรวจต้นทางทุก 15 วินาทีเมื่อเปิดหน้า เก็บข้อมูลล่าสุดแยกใน R2 (`rebrand.json`) และแสดงเวลา/สถานะเมื่อต้นทางขัดข้อง ไม่แก้ไขชีต

Dashboard แสดงจำนวนสาขา สถานะรีโนเวท งบที่บันทึก ความคืบหน้า VM/ผู้รับเหมา/การตลาด และกำหนดเสร็จเร็วที่สุดในรายการที่ยังไม่ระบุว่าเสร็จแล้ว ค่าว่างไม่ถูกตีความว่าไม่เริ่มหรือเป็นงบ 0 ยอดงบรวมเฉพาะช่องที่เป็นตัวเลขพร้อมจำนวนสาขาที่มีข้อมูล ตารางค้นหาและกรองรูปแบบขาย/สถานะได้โดยไม่เปลี่ยนยอด Dashboard และรักษาตัวกรอง/ตำแหน่งเลื่อนระหว่างอัปเดต

ตรวจด้วย `node --test rebrand.test.mjs event-proposals.test.mjs` และ `node realtime.test.mjs` หลัง build รวมถึงทดสอบหน้าจอคอมพิวเตอร์/มือถือ

## พิษณุโลก

เจ้าของยืนยันว่าแถวพิษณุโลก RBS ที่ไม่มีรหัสในส่วน Event คือสาขา VC-014 เดียวกัน เมื่อพบแถว VC-014 หนึ่งแถว ให้ใช้ยอดรายวัน ยอดสะสม และเป้าหมายของแถวรหัสหลักเท่านั้น ไม่บวกยอดหรือเป้าหมายแถว Event ซ้ำ และไม่นำแถวซ้ำไปนับยอด Event รายการกิจกรรมที่มีรหัสอื่นยังแยกตามเดิม

## คาดการณ์ตามช่วงวันที่

วันที่เริ่ม–สิ้นสุดกำหนดจำนวนวันขายอัตโนมัติรวมวันแรกและวันสุดท้าย ยอดขายคาดการณ์เป็นตัวเลขหลัก กรณีต่ำ/สูงเทียบยอดคาดการณ์เดียวกัน (ค่าเริ่มต้น ±10% ปรับได้) และคำนวณกำไร/ROI ใหม่ตามต้นทุนแต่ละกรณี เป้าหมายเพิ่มเติมไม่ใช้กำหนดกรณีต่ำ/สูง วันที่เสนอและวันสุดท้ายที่ต้องคอนเฟิร์มบันทึกพร้อมคำขอและแสดงในรายการเสนอ Event

### Venue database from the three authorized sources

`event-venue-database.mjs` combines Google cost/event schedules with the existing
Sales Report 2025 and 2026 daily dataset, including its separately stored cloud
updates. It does not open SharePoint anonymously or create a new sync schedule.
Google `Event 2025` is read by range A:I to retain each campaign's date range;
repeated monthly rows do not duplicate the full campaign day count.

A report row must match venue, known channel (including branch-code descriptions),
and its complete nonzero activity must fit one schedule. Complete report-month
coverage replaces the sheet sales once, using the full scheduled day count.
Missing/ambiguous schedules and duplicate rows are excluded and remain visible.
When report matching is incomplete, a paired sheet sales/day observation can remain
as a clearly labelled fallback. Original cost sales/days are preserved separately
for COGS/GP ratios and daily PC defaults. Zero-only placeholders are not historical
sales evidence. UI source coverage and each proposal's saved references retain the
source year, month, row and date range. Original sheets are never edited.

Validation: `node --test event-venue-database.test.mjs event-predict.test.mjs
 event-predict-area-pc.test.mjs event-proposals.test.mjs`, then `node build.mjs` and
`node realtime.test.mjs`.

## กระทบยอดช่องทาง Event (20 ก.ย. 2569)

แก้ Sales Report ให้ใช้ส่วน Event ที่ตรวจจากตำแหน่งแถวเช่นเดียวกับภาพรวม Event แทนการดูประเภท CDS/RBS เพียงอย่างเดียว และนับรหัส VA ในส่วนร้านประจำเป็น Stand alone ทุกตาราง สรุป การคาดการณ์ และการเทียบปีก่อนใช้กติกาเดียวกัน

ข้อมูลถึง 17 ก.ย. 2569: เมกา บางนา 60,005 บาทย้ายจาก CDS เข้า Event; อุดรธานี VA-012 48,238 บาทย้ายจาก Event เข้า Stand alone ไม่มีการเพิ่มยอดขายซ้ำ กติกาเดิมของลาดพร้าวและพิษณุโลกยังคงอยู่: ยอด Event 699,454.50 บาท เทียบยอดส่วน Event ใน Excel 733,202 บาท ส่วนต่าง 33,747.50 บาท = ลาดพร้าว 11,622.50 + พิษณุโลก 22,125

ใต้การ์ด Event มีรายละเอียดเทียบยอดกับส่วน Event ใน Excel โดยรวมจากรายการต้นทางและแสดงยอดสาขาที่แยกออกตามเดือนที่เลือก ตรวจ `node --test event-channel-reconciliation.test.mjs branch-mapping.test.mjs sales-summary-comparison.test.mjs` โดยทดสอบยอดรายเดือน รวมปี การคาดการณ์ การแยกเคาน์เตอร์ชื่อเดียวกัน และยอดรวมทุกช่องทางที่ไม่เพิ่มซ้ำ

การแก้วันอัปเดตแยกช่องทาง (21 ก.ย. 2569): หากยอดสาขาถึงวันที่ 17 และ Event ถึงวันที่ 20 ให้สาขาหาร 17; ช่องว่างวันที่ 18–20 ของสาขาเป็นรอข้อมูล ไม่นับเป็นวันยอด 0 ใช้ช่องข้อมูลต้นฉบับก่อนเติม 0 โดยเลข 0 ที่บันทึกจริงยังนับว่าอัปเดตแล้ว แสดงวันของสาขาและ Event แยกกันบนหน้าและแถบสถานะ ข้อมูลเก่าที่มีเพียงยอดรวมโดยไม่มีคอลัมน์รายวันยังใช้วันรายงานเดิม

## หน้าเสนอ Event — 22 ก.ย. 2569

หน้า `/event-proposals` ใช้โทนกราไฟต์และแชมเปญ แยกยอดคาดการณ์/ตั้งเป้ารวมกับวงแหวนสถานะอนุมัติ การ์ดสถานะกรองเฉพาะตารางโดยไม่เปลี่ยนยอดรวม ตัวกรอง คอลัมน์ และตำแหน่งเลื่อนยังอยู่เมื่อข้อมูลรีเฟรช ตัวเลขเคลื่อนไหวเฉพาะเมื่อเปลี่ยนค่า และเคารพ `prefers-reduced-motion` ปุ่มกรองใช้ได้สำหรับผู้ชม; สิทธิ์เปลี่ยนสถานะและการคำนวณเดิมไม่เปลี่ยน

ตรวจ `node --test event-proposals.test.mjs event-proposal-deletions.test.mjs event-review.test.mjs event-permissions.test.mjs` และ `node realtime.test.mjs` หลัง build พร้อมตรวจเบราว์เซอร์ที่ 1512, 1024, 768, 390 และ 320 px: กรองด้วยเมาส์/คีย์บอร์ด เลือกคอลัมน์ รีเฟรชข้อมูล ค่าไม่มีข้อมูล/ศูนย์/ขาดทุน และลดการเคลื่อนไหว

## Approved events in Sales Report

Sales Report reads the current fully approved Event list alongside the existing imported Sales Report data. Approved events appear as pending rows in every occupied month; they contribute no invented actual sales, target or forecast. Imported Event rows attach to a proposal only when the normalized name or curated venue alias, explicit dates and recorded activity fit exactly one proposal and exactly one report row. Store rows remain excluded. Ambiguous matches retain the original sales row and show a separate pending review row. Revoking approval removes pending proposal rows without deleting imported sales. This consumes the existing Sales Report 2026 import; it does not add another SharePoint synchronizer or modify the workbook.

Checks: `node --test approved-sales-events.test.mjs sales-summary-comparison.test.mjs sales-rules.test.mjs sales-forecast-update-date.test.mjs`.

## วิเคราะห์ และ ถาม-ตอบ

`/analysis` ใช้ได้ทั้ง viewer และ admin ที่เข้าสู่ระบบแล้ว ผ่าน `POST /api/analysis` ซึ่งเป็นการอ่านข้อมูล และแยกจากสิทธิ์แก้ไขข้อมูลเดิม ตรวจ Origin, ชนิดข้อมูลและความยาวคำถาม ฝั่งผู้ชมอนุญาตเฉพาะช่องถามกับปุ่มในหน้านี้

ตอบยอดขายรายเดือนจาก snapshot และ cloud report ชุดเดียวกับ Sales Report ค่าเริ่มต้นของยอดตก/โตคือคาดการณ์ปิดเดือนเทียบยอดจริงเต็มเดือนเดียวกันปีก่อน เรียงผลต่างบาท มีฐานเทียบ ยอดจริง/คาดการณ์ วันที่รายงาน และจำนวนสาขาที่ไม่รวม ระบุยอดจริงช่วงเดียวกันหรือเทียบเดือนก่อนเพื่อเทียบรายวันครบทั้งสองช่วง ไม่มีการเติมช่องว่างเป็นศูนย์ ไม่รวม Event ในยอดสาขา

สต็อกอ่านผ่านบริการเดิม ระบุสาขาก่อนอ่านยอดและกรองรุ่น สี ไซซ์ เกรด แยกปกติและ On-Hold แสดงเวลาอัปเดตจริง ไม่พบรายการไม่สรุปเป็นศูนย์ ชื่อสาขาหรือรุ่นกำกวมให้เลือกอีกครั้ง บทสนทนาไม่บันทึกบนเซิร์ฟเวอร์หรือ browser storage

AI เป็นตัวแปลงคำถามเป็นตัวกรองที่ตรวจ schema เท่านั้น ตัวเลขและตารางคำนวณจากข้อมูลต้นทางโดยโค้ด ไม่มี SQL หรือ URL จากคำถามไปเรียกตรง ใช้ Responses API, structured outputs และ `store:false`; ส่งเฉพาะคำถามและตัวกรองก่อนหน้า ไม่ส่งรายงานดิบ API key อยู่ฝั่งเซิร์ฟเวอร์ ตัวแปร `OPENAI_API_KEY` ต้องตั้งผ่าน Sites secrets หลังเชื่อมบริการ; `OPENAI_MODEL` เป็นตัวเลือก (เริ่ม gpt-4.1-mini) ถ้ายังไม่ตั้ง key แสดง “ค้นหาจากข้อมูล · AI รอเชื่อมต่อ” และใช้ตัวอ่านคำถามแบบจำกัดขอบเขต เมื่อ AI ขัดข้องจะระบุโหมดสำรองในคำตอบ

ทดสอบ `node build.mjs` แล้ว `node --test analysis.test.mjs branch-stock.test.mjs sales-yoy.test.mjs` และ `node realtime.test.mjs` ตัวเลข stock ใน unit tests เป็น fixture ไม่ได้ส่งขึ้นข้อมูลจริง

### กิจกรรม / Campaign Studio

`/activities` is a shared, persistent activity planner. It reads the same saved
Scaleup inventory as `/inventory`, the same product-cost sheet as `/product-costs`,
and branch/type identities from Sales Report. Activity records live in D1
`activity_workspace`; browser storage is not the source of truth. A workspace
revision checked by an atomic SQL upsert prevents concurrent edits from silently
overwriting one another or allocating the same inventory twice.

An activity belongs to one month and one branch or a store-type audience. Product
quantities and coupon entitlements are totals for the whole activity, never per
branch multipliers. Costs fill automatically when the exact model and grade match.
Version suffixes, SKU grade suffixes and source aliases are respected. Different
costs for the same model and grade require a factory choice. When the model has no
row in its own grade, use exactly one higher grade (D→C→B→B+→A); never skip a step
or substitute a different model. Existing incomplete rows remain pending. Manual
and unrelated catalogue overrides are rejected. Stored unit costs preserve
the activity's historical cost basis.

Drafts do not reserve stock. Approved activities and completed giveaways that
have not been reconciled reserve against Scaleup `available` across all months.
The planner does not issue or deduct stock in Scaleup. After recording the issue
at the source and refreshing the Inventory tab, an approver can confirm settlement
to release the planner allocation and avoid double subtraction. Completed records
cannot be edited. Cancelling an uncompleted plan releases its allocation.

The instant-discount editor has five fields: kind, discount value, minimum purchase
per entitlement, entitlement count and maximum discount per entitlement. Percent discounts require a positive cap to
calculate a bounded budget; maximum spend = cap × entitlement count. Fixed
discounts use the face value, capped if a positive cap is supplied. There is no
basket assumption or redemption probability; old basket/rate fields do not affect
current budget calculations. Missing percent caps remain explicitly incomplete
and cannot be approved. Coupon groups are independent; stacked discounts are not
assumed. Total budget = gift cost + full-redemption discount budget + other costs.
The approval guard compares this against an entered nonzero budget.

Month selectors show Thai month names and Buddhist Era years. The activity detail
fits the viewport with paginated products and coupon groups. It shows saved
available stock, giveaway quantity and projected remainder, using availableAtSave
after other activity allocations for new saves (legacy rows use stockAtSave).
Completion preserves the originally saved stock basis. These are plan snapshots,
not a live warehouse issue ledger. Mobile switches between product and budget
panels without vertical scrolling.

The product picker separates SKU, model, category and grade. Automatic costs use
only complete Product Costs rows with matching model and grade. Zero/missing
pre-VAT costs and rows under review cannot be used as authoritative totals. The
searchable picker contains only the matched model and grade, including the one-step
fallback when the original grade has no row. The server enforces the same rule
and resolves the VAT-inclusive amount from the source. Reopening an editable plan
repairs outdated or unrelated references; viewing historical records does not
rewrite them. Cards identify the actual reference grade and link to its source row,
even when that row is awaiting an update. Categories use matching source TYPE or
identifiable inventory descriptions.

Sales forecasts assume every entitlement is redeemed in a separate purchase at
the specified minimum. Instant discount is capped by the entitlement cap and
basket amount. Sold-product cost is 22% of pre-discount sales. Forecast profit =
after-discount receipts − sold-product cost − giveaway cost − other expenses.
Maximum campaign discount exposure remains separate from this minimum-purchase
scenario. Missing thresholds or giveaway costs never imply a complete profit.

Viewers read/filter/export; assistants draft and submit for approval. CEO / Trade
Manager approve or reject drafts/pending requests. Rejection notes are optional;
rejected activities do not reserve stock or enter monthly totals and may be
edited/resubmitted. Approvers also complete, cancel approved plans, and confirm
inventory settlement. Tests:
`node --test activities.test.mjs role-permissions.test.mjs inventory.test.mjs`.

### Event proposal workflow

The default proposal table combines Trade/CEO approvals, shows an independent event status, and moves terms and images into the Details dialog. Events with both approvals automatically show `รอจัดงาน`. Editors can mark them `จัดแล้ว`, or cancel any event with a required cancellation reason (up to 1,000 characters). Cancellation preserves the original approvals and excludes the event from the approved-event planning feed. The proposal overview still totals every proposal status, as labelled. Excel exports include event status and cancellation notes.

Workflow state persists in `event_proposal_workflow` (migration 0007). Updates check the proposal revision and workflow revision, with atomic approval/revision checks on writes. Read-only users cannot change status. The status dialog keeps entered text when a save fails and blocks background refresh while open.

Validation: `node --test event-workflow.test.mjs event-proposals.test.mjs event-proposal-deletions.test.mjs role-permissions.test.mjs event-slide.test.mjs proposal-excel.test.mjs` after `node build.mjs`.

The proposal overview includes a distinct Cancelled card. Cancelled proposals retain their saved approvals but are excluded from active approval counts; all status cards partition the month's proposals without double counting. The top-right event-month selector scopes the financial overview, status counts, both tables, and Excel export. Recorded month/year values are normalized across web and sheet formats; unknown years remain explicitly unknown. Month selection survives automatic refreshes and remains active when status filters are cleared.

## แคปภาพบน Safari

แปลงภาพพื้นหลัง SVG แบบ data URL เป็น PNG เฉพาะในสำเนาหน้าสำหรับแคป ก่อนส่งให้ html2canvas ป้องกัน WebKit ทำ canvas เป็นภาพที่ส่งออกไม่ได้เมื่อสร้างลวดลายจาก SVG (`toBlob: SecurityError`) ทั้งแคปเต็มหน้าและลากเลือกพื้นที่ใช้ขั้นตอนเดียวกัน หน้าจอจริง ไอคอน และกราฟ SVG ไม่ถูกแก้ไข

ทดสอบด้วย `node scripts/screen-capture.browser-test.mjs` สำหรับ Chromium และ `CAPTURE_BROWSER=webkit node scripts/screen-capture.browser-test.mjs` สำหรับ WebKit โดยติดตั้ง Playwright และเบราว์เซอร์ไว้ก่อน หากใช้ Playwright จาก runtime ให้ระบุ `PLAYWRIGHT_MODULE` เป็นพาธโมดูล ทดสอบไฟล์ PNG จริง ขนาด/เนื้อหาภาพ พื้นที่หลังเลื่อนหน้า และการแคปซ้ำ

## ทดลองยอดขายในสไลด์ผู้บริหาร

หน้าสไลด์เปิดด้วยยอดขายคาดการณ์ 0 เสมอ คลิกตัวเลขบนสไลด์เพื่อแก้ยอด ระบบคำนวณกำไร/ขาดทุน ต้นทุนรวม Margin และ ROI ทันทีด้วย `forecast` เดิม รวมค่าแรงต่อคนและคอมมิชชันตามขั้นยอดขาย ยอดเป้าหมายและข้อเสนอที่บันทึกยังคงเดิม ค่าทดลองอยู่เฉพาะหน้าสไลด์รอบนี้และใช้ใน PNG/เต็มจอด้วย เปิดใหม่กลับเป็น 0 หากต้นทุนไม่ครบแสดง — พร้อมแจ้งให้ถามเจ้าของ กรอกยอด 0–10,000,000,000 บาท ทศนิยมไม่เกิน 2 ตำแหน่ง รองรับลูกน้ำคั่นหลักพัน

ตรวจ `node --test event-slide.test.mjs event-predict.test.mjs event-compensation.test.mjs` และ `node build.mjs` ทดสอบหน้าจอด้วยข้อมูลจำลอง: ค่าเริ่มต้น 0, ยอด 85,000 → กำไร 25,625 เมื่อมีคอมมิชชัน 850, ดาวน์โหลด PNG และปิดการนำเสนอ/ดาวน์โหลดเมื่อกรอกค่าติดลบ

## แก้เงื่อนไขจากสไลด์

ผู้มีสิทธิ์แก้ข้อเสนอที่สร้างในเว็บแก้รูปแบบ ค่าเช่า/GP ต้นทุนสินค้า ค่าแรง PC ขนส่ง และค่าใช้จ่ายอื่นได้ตรงสไลด์ ค่าร่างใช้สูตร forecast ร่วมกับข้อเสนอ และบันทึกผ่าน PATCH เดิมซึ่งตรวจ revision คำนวณใหม่บนเซิร์ฟเวอร์ และคืนสถานะรออนุมัติ เมื่อบันทึกจะอ่านข้อมูลกลับและรีเฟรชตารางเสนอ Event ค่าแรงที่แก้จากเรทอ้างอิงเปลี่ยนเป็นกรอกเองโดยยังคงกฎคอมมิชชันเดิม ยอดขายทดลองยังใช้เฉพาะสไลด์ การกดยกเลิกคืนค่าใช้จ่ายที่บันทึกไว้ ช่องต้นทุนที่ไม่ครบไม่ถือเป็นศูนย์

ตรวจ `node --test event-slide.test.mjs event-slide-terms.test.mjs event-request-edit.test.mjs event-compensation.test.mjs` และ browser fixture `scripts/event-slide-terms.browser-test.mjs` (ตั้ง PLAYWRIGHT_MODULE และ PLAYWRIGHT_BROWSERS_PATH ตาม runtime)

## กำไรขั้นต้นรายสาขา — 30 ก.ย. 2026

`/branch-profit` uses the existing Warroom session for every role, including viewers. All report assets and `/api/branch-profit` are authenticated; only same-origin authenticated POST `/api/branch-profit/refresh` imports one selected month. A year refresh processes elapsed months sequentially, with progress. Each month validates source totals, duplicates, time boundaries and distinct order counts before replacing its D1 snapshot. Failed imports preserve the last saved month; durable per-month leases prevent overlapping updates. This only reads Odoo.

`ODOO_LOGIN`, `ODOO_PASSWORD` (Sites secrets) and `ODOO_DATABASE` are runtime configuration. The destination is fixed to erp.ving.run; authentication redirects and untrusted hosts are rejected. No credentials are delivered to the browser. New products without an approved exact identity remain pending. New branches retain their ERP configuration IDs; names identifying people are masked. Existing branch mapping covers the approved September workbook, and unmapped historical types are explicitly marked pending.

Seed source: Odoo report.pos.order, January–September 2026, 51,612 daily SKU groups, totals including VAT 53,402,526.86. Thai product identities are resolved by stable product IDs. AG current purchase cost is excluding VAT, sales divide by1.07. Approved waiting-cost models use25% of sales excluding VAT with a waiting-update note; unmatched products remain held. TORANI A uses TSS176.55. Current costs are not historical lot costs. Any daily absolute quantity above100 causes that month/config/product to be held for review, including corrections; no ERP records are altered. Zero-value unresolved gifts block full-branch profit. Signed refunds and discounts are preserved.

The page offers year/month/day/branch/type filters, sortable/searchable status tables, daily/monthly charts, branch SKU detail and a five-sheet Excel export matching displayed branches. Order count per SKU is not additive; daily branch order totals have a dedicated sheet. Cost snapshots are dated30Sep2026; the update button refreshes sales, not the external cost sheet.

Checks: `node build.mjs`, `node --test branch-profit.test.mjs`, `node realtime.test.mjs`. September reconciles to exVAT sales4,898,574.36, coveredCOGS1,308,892.14, partialGP3,583,880.34 and54complete branches. Browser verified viewer refresh through liveOdoo to localD1, filters, day drilldown, exportedXLSX totals and mobile layout.

## ค้นหาสาขาและสัดส่วนต้นทุน — 30 ก.ย. 2026

ตัวกรองสาขาด้านบนพิมพ์ค้นหาชื่อไทย/อังกฤษหรือรหัสได้ เลือกด้วยคลิกหรือปุ่มลูกศรและ Enter; Escape หรือออกจากช่องคืนค่าที่เลือกเดิม เลือก “ทุกสาขา” เพื่อยกเลิกตัวกรอง โดย Dashboard กราฟ ตาราง และ Export ใช้สาขาที่เลือกเดียวกัน

การ์ดต้นทุนแสดงสัดส่วนต้นทุนต่อยอดขายไม่รวม VAT เฉพาะรายการที่คำนวณได้ (`cost / covered × 100`) รวมต้นทุนประมาณการเดิม ไม่รวมยอดรอตรวจในฐานหาร แสดง — เมื่อฐานเป็นศูนย์ และแสดง GP% ของส่วนคำนวณได้เมื่อยังมีรายการรอตรวจ ตรวจด้วย `node --test branch-profit.test.mjs`, `node realtime.test.mjs` และ `scripts/branch-profit.browser-test.mjs` (กำหนด PLAYWRIGHT_MODULE และ PLAYWRIGHT_BROWSERS_PATH ตาม runtime)


## เปอร์เซ็นต์และการเรียงตาราง — 30 ก.ย. 2026

GP% = กำไรส่วนคำนวณได้ / ยอดขายส่วนคำนวณได้; ต้นทุน % = ต้นทุนส่วนคำนวณได้ / ยอดขายส่วนคำนวณได้ ใช้ยอดรวมก่อนหาร แสดงเปอร์เซ็นต์พร้อมหมายเหตุเมื่อมีรายการค้าง โดยกำไรทั้งสาขายังว่าง ฐานขายเป็นศูนย์แสดง — ไม่ประมาณต้นทุนของรายการขาดข้อมูลเพิ่ม

หัวตารางสาขาและสินค้าเรียงตัวเลขได้ทั้งสองทิศทาง ช่องรายละเอียดค้นหาสินค้า/SKU/วันที่และกรองสถานะได้ Excel สรุปสาขาและรายละเอียดสินค้าเพิ่ม GP% และต้นทุน % ตามฐานเดียวกับหน้าจอ


## รายการรอตรวจสอบใช้ GP ประมาณการ 22% — 30 ก.ย. 2026

สถานะ hold ใช้กำไร 22% และต้นทุน 78% ของยอดขายไม่รวม VAT รวมทั้งรายการคืนสินค้าและรายการจำนวนผิดปกติ โดยคงสถานะและเหตุผลรอตรวจ ไม่เปลี่ยนข้อมูล Odoo ต้นทุนส่วนนี้นับเป็นประมาณการและรวมใน Dashboard กราฟ ตาราง รายละเอียด และ Excel ส่วนรายการ estimate เดิมยังใช้ต้นทุน 25% ยอดขายฐานศูนย์ไม่แสดงอัตราส่วน กำไรทั้งสาขาแสดงทันที รวมค่าประมาณ GP22% ของรายการรอตรวจ และติดป้ายรวมค่าประมาณ ตัวชี้วัดความครบถ้วนวัดก่อนประมาณ GP22%

## อัพเดทข้อมูลทุกแท็บ — 2 ต.ค. 2026

Settings > อัพเดทข้อมูล starts a source-level refresh for all connected tabs. The authenticated, same-origin `/api/data-refresh` endpoint exposes an explicit source allow-list; viewers may import read-only reports without gaining business-edit permissions. Independent sources run three at a time; Odoo months run sequentially. All stock-report months (24), forecast-history months (6), next-page chunks and branch balances are included. Summary and other dependent views read again after source imports. The client reports per-source success, failure and manual-import limitations, retries only actionable failures, and keeps permanent limitations visible after retry.

Manual refresh bypasses both memory and persisted TTLs. A same-origin freshness marker invalidates older caches when opening another tab. Failed imports keep their prior snapshots; forced refresh surfaces persistence failures. Event catalog and contracts now have sanitized direct Google Sheets adapters, while preserving newer normal-sync records and contract edits. Current sales feed activity/promotion branch destinations.

Product costs accept the current AVG header variants, read purchase cost from AG and remarks from AH. GP refreshes only previously approved exact row/model/grade/factory mappings and retains the last applied live cost when a later row is missing or needs review. Unknown identities and existing estimate rules remain explicit. Source-only snapshots (Content/News/Intel/jobs), imported PIVOT, historical comparison files and compensation reference files cannot be pulled remotely; the refresh results explicitly request upstream sync or a new import.

Validation: `node build.mjs`; `node --test data-refresh.test.mjs product-cost.test.mjs branch-profit.test.mjs event-recovery.test.mjs summary-realtime.test.mjs role-permissions.test.mjs contracts-workspace.test.mjs activities.test.mjs stock-forecast.test.mjs stock-report.test.mjs` (59 passing); `node realtime.test.mjs`. Live read-only parsing verified 95 cost items, 15 contracts, 116 historical and 76 current event catalog entries. In-app browser verified Settings entry, progress, dynamic pages, partial failure/retry, dependent refresh and 390px mobile layout with no console errors; source failure interaction used local fixtures, not production imports.


### Event staffing deployment

The setup/pickup planner stores multiple selected team members per action in `event_staff_assignments`. Package with the Sites workflow: the archive must contain `dist/server/index.js` and `dist/.openai/drizzle/0013_fair_miek.sql`. A root-level `.openai/drizzle` does not apply this migration. After deploying, verify the table exists in the live DB; a successful Worker upload alone does not verify persistence.
