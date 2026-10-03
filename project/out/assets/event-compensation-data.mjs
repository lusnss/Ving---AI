// Rates and event-specific incentive terms from เรทEvent.xlsx. No employee information.
export const eventCompensationVersion = '2026-09-23';
export const eventCompensationProfiles = [
  {
    "id": "October2026-C2",
    "name": "เดอะมอลล์บางแค (1 คน)",
    "dates": "1 - 7 ต.ค. 69",
    "range": {
      "start": "2026-10-01",
      "end": "2026-10-07"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2026",
      "rateCell": "C4",
      "ruleCell": "C7"
    },
    "wage": null,
    "rateText": "",
    "workTime": "อาทิตย์-พฤ 10:00-21:30 น.\nศุกร์-เสาร์ 10:00-22:00 น.",
    "pcCount": 1,
    "targetText": "80,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 80000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 80,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2026-C9",
    "name": "Event โรบินสันสมุทรปราการ (1 คน)",
    "dates": "9 - 22 ต.ค. 69",
    "range": {
      "start": "2026-10-09",
      "end": "2026-10-22"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2026",
      "rateCell": "C11",
      "ruleCell": "C14"
    },
    "wage": null,
    "rateText": "",
    "workTime": "10.00-21.00 น.",
    "pcCount": 1,
    "targetText": "60,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 60000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 60,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "September2026-C2",
    "name": "MRT metro mallจตุจักร (2 คน)",
    "dates": "4 - 6 ก.ย. 69",
    "range": {
      "start": "2026-09-04",
      "end": "2026-09-06"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "September2026",
      "rateCell": "C4",
      "ruleCell": "C7"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน   หักภาษี 3%",
    "workTime": "08.00 - 20.00 น.",
    "pcCount": 2,
    "targetText": "50,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 50000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 50,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "September2026-F2",
    "name": "Pattaya Marathon 2026 (2 คน)",
    "dates": "24 - 26 ก.ย. 69",
    "range": {
      "start": "2026-09-24",
      "end": "2026-09-26"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "September2026",
      "rateCell": "F4",
      "ruleCell": "F7"
    },
    "wage": {
      "kind": "range",
      "min": 550,
      "max": 700
    },
    "rateText": "550-700 บาท/วัน   หักภาษี 3%",
    "workTime": "24 ก.ย. 69 l เวลา 12.00 - 20.00 น. \n25 ก.ย. 69 l เวลา 12.00 - 22.00 น.\n26 ก.ย. 69 l เวลา 12.00 - 20.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "September2026-C9",
    "name": "เดอะมอลล์บางแค (2 คน)",
    "dates": "10 - 16 ก.ย. 69",
    "range": {
      "start": "2026-09-10",
      "end": "2026-09-16"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "September2026",
      "rateCell": "C11",
      "ruleCell": "C14"
    },
    "wage": {
      "kind": "range",
      "min": 650,
      "max": 700
    },
    "rateText": "650-700 บาท/วัน   หักภาษี 3%",
    "workTime": "อาทิตย์-พฤ 10:00-21:30 น.\nศุกร์-เสาร์ 10:00-22:00 น.",
    "pcCount": 2,
    "targetText": "80,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 80000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 80,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "September2026-F9",
    "name": "เซ็นทรัลเมกาบางนา (2 คน)",
    "dates": "3 - 16 ก.ย. 69",
    "range": {
      "start": "2026-09-03",
      "end": "2026-09-16"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "September2026",
      "rateCell": "F11",
      "ruleCell": "F14"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "September2026-C16",
    "name": "ซีคอนสแควร์ ศรีนครินทร์ (1 คน)",
    "dates": "17 - 27 ก.ย. 69",
    "range": {
      "start": "2026-09-17",
      "end": "2026-09-27"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "September2026",
      "rateCell": "C18",
      "ruleCell": "C21"
    },
    "wage": null,
    "rateText": "",
    "workTime": "จันทร์-ศุกร์ 10:30-20:00 น.\nเสาร์-อาทิตย์ 10:00-20:00 น.",
    "pcCount": 1,
    "targetText": "120,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 120000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 120,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2026-C2",
    "name": "แฟชั่นไอซ์แลนด์ ชั้น 1 / เก็บเงินเอง (2 คน)",
    "dates": "12 - 26 ส.ค. 69",
    "range": {
      "start": "2026-08-12",
      "end": "2026-08-26"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2026",
      "rateCell": "C4",
      "ruleCell": "C7"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2026-C9",
    "name": "The Promenade ชั้น 1 / เก็บเงินเอง (2 คน)",
    "dates": "14 - 25 ส.ค. 69",
    "range": {
      "start": "2026-08-14",
      "end": "2026-08-25"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2026",
      "rateCell": "C11",
      "ruleCell": "C14"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2026-F9",
    "name": "แฟชั่นไอซ์แลนด์ Kelly (1 คน)",
    "dates": "24 ส.ค. - 6 ก.ย.. 69",
    "range": {
      "start": "2026-08-24",
      "end": "2026-09-06"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2026",
      "rateCell": "F11",
      "ruleCell": "F14"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 1,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 200000,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 200,000 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2026-C16",
    "name": "เซ็นทรัลอีสต์วิลล์ (2 คน)",
    "dates": "1 - 31 ก.ค. 69",
    "range": {
      "start": "2026-07-01",
      "end": "2026-07-31"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2026",
      "rateCell": "C18",
      "ruleCell": "C21"
    },
    "wage": {
      "kind": "calendar",
      "daily": [
        650,
        600,
        600,
        600,
        600,
        600,
        650
      ]
    },
    "rateText": "จ - ศ   600 บาท/วัน     \nส - อา 650 บาท/วัน   หักภาษี 3% (จากค่าตอบแทนทั้งหมด)",
    "workTime": "จ.–ศ. 10:30–22:00 น. \nส.–อา. 10:00–22:00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": [
      "ชีต August2026 แต่วันที่ยังระบุเดือน ก.ค. 69 [ต้องถามเจ้าของ]"
    ]
  },
  {
    "id": "July2026-C2",
    "name": "Terminal21 Pattaya (2 คน)",
    "dates": "14 - 26 ก.ค. 69",
    "range": {
      "start": "2026-07-14",
      "end": "2026-07-26"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2026",
      "rateCell": "C4",
      "ruleCell": "C7"
    },
    "wage": {
      "kind": "range",
      "min": 650,
      "max": 700
    },
    "rateText": "650-700 บาท/วัน   หักภาษี 3%",
    "workTime": "จ-พฤ 11.00 - 22.00 น.\nศ-อา 11.00 - 23.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2026-F2",
    "name": "งานบ้านและสวน ไบเทคบางนา (6 คน)",
    "dates": "31 ก.ค. - 9 ส.ค. 69",
    "range": {
      "start": "2026-07-31",
      "end": "2026-08-09"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2026",
      "rateCell": "F4",
      "ruleCell": "F7"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%",
    "workTime": "09.30 - 21.00 น.",
    "pcCount": 6,
    "targetText": "1.5 ล้าน",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          1000000,
          0.005
        ],
        [
          1500000,
          0.01
        ]
      ]
    },
    "commissionText": "ยอดขาย 1 ล้าน คอมมิชชั่น 0.5% ตั้งแต่บาทแรก\nยอดขาย 1.5 ล้าน คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2026-C9",
    "name": "เซ็นทรัลเมกาบางนา (2 คน)",
    "dates": "2 - 15 ก.ค. 69",
    "range": {
      "start": "2026-07-02",
      "end": "2026-07-15"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2026",
      "rateCell": "C11",
      "ruleCell": "C14"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2026-F9",
    "name": "Terminal พระราม3 (2 คน)",
    "dates": "13 - 27 ก.ค. 69",
    "range": {
      "start": "2026-07-13",
      "end": "2026-07-27"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2026",
      "rateCell": "F11",
      "ruleCell": "F14"
    },
    "wage": null,
    "rateText": "",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2026-C16",
    "name": "CU Fit Deals ยกกำลังสอง — จามจุรีสแควร์ (เก็บเงินเอง) (2 คน)",
    "dates": "20 - 22 ก.ค. 69",
    "range": {
      "start": "2026-07-20",
      "end": "2026-07-22"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2026",
      "rateCell": "C18",
      "ruleCell": "C21"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%",
    "workTime": "10.00-20.00 น.",
    "pcCount": 2,
    "targetText": "50,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 50000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 50,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2026-F16",
    "name": "แฟชั่นไอซ์แลนด์ Sneaker (1 คน)",
    "dates": "28 ก.ค. - 9 ส.ค. 69",
    "range": {
      "start": "2026-07-28",
      "end": "2026-08-09"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2026",
      "rateCell": "F18",
      "ruleCell": "F21"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 1,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2026-C23",
    "name": "เซ็นทรัลอีสต์วิลล์ (2 คน)",
    "dates": "1 - 31 ก.ค. 69",
    "range": {
      "start": "2026-07-01",
      "end": "2026-07-31"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2026",
      "rateCell": "C25",
      "ruleCell": "C28"
    },
    "wage": {
      "kind": "calendar",
      "daily": [
        650,
        600,
        600,
        600,
        600,
        600,
        650
      ]
    },
    "rateText": "จ - ศ   600 บาท/วัน     \nส - อา 650 บาท/วัน   หักภาษี 3% (จากค่าตอบแทนทั้งหมด)",
    "workTime": "จ.–ศ. 10:30–22:00 น. \nส.–อา. 10:00–22:00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท (รวมยอดขายตั้งแต่ 1 พ.ค. 69)",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": [
      "150,000 บาท (รวมยอดขายตั้งแต่ 1 พ.ค. 69) · ประมาณการนี้ใช้ยอดของงานที่กรอก ยังไม่รวมยอดสะสมรอบอื่น"
    ]
  },
  {
    "id": "June2026-C2",
    "name": "True Digital (สุขุมวิท 101) (2 คน)",
    "dates": "18 - 29 มิ.ย. 69",
    "range": {
      "start": "2026-06-18",
      "end": "2026-06-29"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2026",
      "rateCell": "C4",
      "ruleCell": "C7"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2026-F2",
    "name": "แฟชั่นไอซ์แลนด์ SportWorld (เก็บเงินเอง) (2 คน)",
    "dates": "16 - 28 มิ.ย. 69",
    "range": {
      "start": "2026-06-16",
      "end": "2026-06-28"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2026",
      "rateCell": "F4",
      "ruleCell": "F7"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2026-C9",
    "name": "เซ็นทรัลอีสต์วิลล์ (2 คน)",
    "dates": "1 - 30 มิ.ย. 69",
    "range": {
      "start": "2026-06-01",
      "end": "2026-06-30"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2026",
      "rateCell": "C11",
      "ruleCell": "C14"
    },
    "wage": {
      "kind": "calendar",
      "daily": [
        650,
        600,
        600,
        600,
        600,
        600,
        650
      ]
    },
    "rateText": "จ - ศ   600 บาท/วัน     \nส - อา 650 บาท/วัน   หักภาษี 3% (จากค่าตอบแทนทั้งหมด)",
    "workTime": "จ.–ศ. 10:30–22:00 น. \nส.–อา. 10:00–22:00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท (รวมยอดขายตั้งแต่ 1 พ.ค. 69)",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": [
      "150,000 บาท (รวมยอดขายตั้งแต่ 1 พ.ค. 69) · ประมาณการนี้ใช้ยอดของงานที่กรอก ยังไม่รวมยอดสะสมรอบอื่น"
    ]
  },
  {
    "id": "June2026-F9",
    "name": "แฟชั่นไอซ์แลนด์ Sneaker (เก็บเงินเอง) (2 คน)",
    "dates": "30 มิ.ย. - 12 ก.ค. 69",
    "range": {
      "start": "2026-06-30",
      "end": "2026-07-12"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2026",
      "rateCell": "F11",
      "ruleCell": "F14"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2026-C16",
    "name": "แฟชั่นไอซ์แลนด์ Kelly (1 คน)",
    "dates": "21 พ.ค. - 4 มิ.ย. 69",
    "range": {
      "start": "2026-05-21",
      "end": "2026-06-04"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2026",
      "rateCell": "C18",
      "ruleCell": "C21"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 1,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 200000,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 200,000 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2026-F16",
    "name": "Life Center / เก็บเงินเอง (2 คน)",
    "dates": "15 - 26 มิ.ย. 69",
    "range": {
      "start": "2026-06-15",
      "end": "2026-06-26"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2026",
      "rateCell": "F18",
      "ruleCell": "F21"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน   หักภาษี 3%",
    "workTime": "09.00-21.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2026-C23",
    "name": "เมืองทองธานี sports mall (2 คน)",
    "dates": "20 - 28 มิ.ย. 69",
    "range": {
      "start": "2026-06-20",
      "end": "2026-06-28"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2026",
      "rateCell": "C25",
      "ruleCell": "C28"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "11:00-20:30 hrs. (Monday-Friday)\n10:30-21:00 hrs. (Saturday-Sunday)",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2026-F23",
    "name": "สินสาธร (1 คน)",
    "dates": "29 มิ.ย. - 3 ก.ค. 69",
    "range": {
      "start": "2026-06-29",
      "end": "2026-07-03"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2026",
      "rateCell": "F25",
      "ruleCell": "F28"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน   หักภาษี 3%",
    "workTime": "07.30-18.00 น.",
    "pcCount": 1,
    "targetText": "60,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 60000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 60,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2026-C11",
    "name": "Outlet Pattaya (1 คน)",
    "dates": "1 - 31 พ.ค. 69",
    "range": {
      "start": "2026-05-01",
      "end": "2026-05-31"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2026",
      "rateCell": "C13",
      "ruleCell": "C16"
    },
    "wage": {
      "kind": "range",
      "min": 550,
      "max": 600
    },
    "rateText": "550-600 บาท/วัน   หักภาษี 3%",
    "workTime": "จ-พฤ 10.00 - 20.00 น.\nศ-อา 10.00 - 21.00 น.",
    "pcCount": 1,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2026-F11",
    "name": "เดอะมอลล์บางกะปิ ชั้น G (2 คน)",
    "dates": "28 พ.ค. - 4 มิ.ย. 69",
    "range": {
      "start": "2026-05-28",
      "end": "2026-06-04"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2026",
      "rateCell": "F13",
      "ruleCell": "F16"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "อาทิตย์ - พฤหัสบดี: 10.00-21.00 น\nศุกร์ เสาร์: กะเช้า 10.00-21.00 น.\nกะบ่าย 11.00-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2026-C18",
    "name": "Sun Tower (1 คน)",
    "dates": "5 - 8 พ.ค. 69",
    "range": {
      "start": "2026-05-05",
      "end": "2026-05-08"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2026",
      "rateCell": "C20",
      "ruleCell": "C23"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "7.00 - 18.00 น.",
    "pcCount": 1,
    "targetText": "60,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 60000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 60,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2026-C25",
    "name": "Outdoor Fest 2026 — ศูนย์สิริกิติ์ (1 คน)",
    "dates": "21 - 24 พ.ค. 69",
    "range": {
      "start": "2026-05-21",
      "end": "2026-05-24"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2026",
      "rateCell": "C27",
      "ruleCell": "C30"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "11.00-20.00 น.",
    "pcCount": 1,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "April2026-C3",
    "name": "Terminal21 Pattaya (2 คน)",
    "dates": "21 เม.ย. - 4 พ.ค. 69",
    "range": {
      "start": "2026-04-21",
      "end": "2026-05-04"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "April2026",
      "rateCell": "C5",
      "ruleCell": "C8"
    },
    "wage": {
      "kind": "range",
      "min": 650,
      "max": 700
    },
    "rateText": "650-700 บาท/วัน   หักภาษี 3%",
    "workTime": "จ-พฤ 11.00 - 22.00 น.\nศ-อา 11.00 - 23.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "April2026-F3",
    "name": "ตลาดเสรี พาราไดซ์ พาร์ค / เก็บเงินเอง (1 คน)",
    "dates": "16 - 30 เม.ย. 69",
    "range": {
      "start": "2026-04-16",
      "end": "2026-04-30"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "April2026",
      "rateCell": "F5",
      "ruleCell": "F8"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%",
    "workTime": "08:00 - 20:00 น.",
    "pcCount": 1,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "April2026-C10",
    "name": "แฟชั่นไอซ์แลนด์ ชั้น 2 / เก็บเงินเอง (2 คน)",
    "dates": "1 - 9 เม.ย. 69",
    "range": {
      "start": "2026-04-01",
      "end": "2026-04-09"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "April2026",
      "rateCell": "C12",
      "ruleCell": "C15"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "April2026-F10",
    "name": "Life Center / เก็บเงินเอง (2 คน)",
    "dates": "17 - 24 เม.ย. 69",
    "range": {
      "start": "2026-04-17",
      "end": "2026-04-24"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "April2026",
      "rateCell": "F12",
      "ruleCell": "F15"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "April2026-C17",
    "name": "เดอะสตรีท รัชดา ลานโปร SPW (2 คน)",
    "dates": "1 - 10 เม.ย. 69",
    "range": {
      "start": "2026-04-01",
      "end": "2026-04-10"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "April2026",
      "rateCell": "C20",
      "ruleCell": "C22"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "11.00 - 21.30 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "March2026-C11",
    "name": "Terminal พระราม3 (2 คน)",
    "dates": "24 มี.ค. - 8 เม.ย. 69",
    "range": {
      "start": "2026-03-24",
      "end": "2026-04-08"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "March2026",
      "rateCell": "C13",
      "ruleCell": "C16"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "February2026-C11",
    "name": "แฟชั่นไอซ์แลนด์ Kelly (2 คน)",
    "dates": "13 - 25 ก.พ. 69",
    "range": {
      "start": "2026-02-13",
      "end": "2026-02-25"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "February2026",
      "rateCell": "C13",
      "ruleCell": "C16"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "February2026-C18",
    "name": "ving sale @สนามเทพ (1 คน)",
    "dates": "25 ก.พ. - 3 มี.ค. 69",
    "range": {
      "start": "2026-02-25",
      "end": "2026-03-03"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "February2026",
      "rateCell": "C20",
      "ruleCell": "C23"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "11:30 - 20:30 น.",
    "pcCount": 1,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "January2026-F3",
    "name": "เซ็นทรัลเมกาบางนา (2 คน)",
    "dates": "11 - 21 ม.ค. 69",
    "range": {
      "start": "2026-01-11",
      "end": "2026-01-21"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "January2026",
      "rateCell": "F5",
      "ruleCell": "F8"
    },
    "wage": {
      "kind": "flat",
      "amount": 750
    },
    "rateText": "650 บาท/วัน + ค่าเดินทาง 100 บาท/วัน     หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "January2026-C11",
    "name": "เซ็นทรัลปิ่นเกล้า (1 คน)",
    "dates": "8 - 21 ม.ค. 69",
    "range": {
      "start": "2026-01-08",
      "end": "2026-01-21"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "January2026",
      "rateCell": "C13",
      "ruleCell": "C16"
    },
    "wage": {
      "kind": "flat",
      "amount": 625
    },
    "rateText": "625 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 1,
    "targetText": "80,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 80000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 80,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "January2026-F11",
    "name": "เซ็นทรัลเมกาบางนา (2 คน)",
    "dates": "22 ม.ค. - 4 ก.พ. 69",
    "range": {
      "start": "2026-01-22",
      "end": "2026-02-04"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "January2026",
      "rateCell": "F13",
      "ruleCell": "F16"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "January2026-C18",
    "name": "เทอร์มินอล 21​ อโศก (2 คน)",
    "dates": "16 - 28 ม.ค. 69",
    "range": {
      "start": "2026-01-16",
      "end": "2026-01-28"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "January2026",
      "rateCell": "C20",
      "ruleCell": "C23"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "January2026-C25",
    "name": "เซ็นทรัลอีสต์วิลล์ (2 คน)",
    "dates": "22 ม.ค. - 4 ก.พ. 69",
    "range": {
      "start": "2026-01-22",
      "end": "2026-02-04"
    },
    "year": 2026,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "January2026",
      "rateCell": "C27",
      "ruleCell": "C30"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 200000,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 200,000 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "December2025-C3",
    "name": "เซ็นทรัลลาดพร้าว BCC Hall (2 คน)",
    "dates": "18 ธ.ค. 68 - 4 ม.ค. 69",
    "range": {
      "start": "2025-12-18",
      "end": "2026-01-04"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "December2025",
      "rateCell": "C5",
      "ruleCell": "C9"
    },
    "wage": {
      "kind": "flat",
      "amount": 550,
      "overrides": {
        "2025-12-31": 800,
        "2026-01-01": 800
      }
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "December2025-C11",
    "name": "Terminal21 Pattaya (2 คน)",
    "dates": "25 พ.ย. - 7 ธ.ค. 68",
    "range": {
      "start": "2025-11-25",
      "end": "2025-12-07"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "December2025",
      "rateCell": "C13",
      "ruleCell": "C16"
    },
    "wage": {
      "kind": "range",
      "min": 650,
      "max": 700
    },
    "rateText": "650-700 บาท/วัน   หักภาษี 3%",
    "workTime": "จ-พฤ 11.00 - 22.00 น.\nศ-อา 11.00 - 23.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "December2025-F11",
    "name": "Event เดอะคริสตัล เอกมัย - รามอินทรา (2 คน)",
    "dates": "8 - 21 ธ.ค. 68",
    "range": {
      "start": "2025-12-08",
      "end": "2025-12-21"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "December2025",
      "rateCell": "F13",
      "ruleCell": "F16"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "December2025-C18",
    "name": "แฟชั่นไอซ์แลนด์ Sportworld (2 คน)",
    "dates": "9 - 18 ธ.ค. 68",
    "range": {
      "start": "2025-12-09",
      "end": "2025-12-18"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "December2025",
      "rateCell": "C20",
      "ruleCell": "C23"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "December2025-F18",
    "name": "ลานโปร เดอะมอลล์งามวงศ์วาน (2 คน)",
    "dates": "4 - 10 ธ.ค. 68",
    "range": {
      "start": "2025-12-04",
      "end": "2025-12-10"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "December2025",
      "rateCell": "F20",
      "ruleCell": "F23"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "December2025-C25",
    "name": "เดอะสตรีท รัชดา (2 คน)",
    "dates": "1 - 15 ธ.ค. 68",
    "range": {
      "start": "2025-12-01",
      "end": "2025-12-15"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "December2025",
      "rateCell": "C28",
      "ruleCell": "C30"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "11.00 - 21.30 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "November2025-C3",
    "name": "Outlet Pattaya",
    "dates": "1 - 30 พ.ย. 68",
    "range": {
      "start": "2025-11-01",
      "end": "2025-11-30"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "November2025",
      "rateCell": "C5",
      "ruleCell": "C8"
    },
    "wage": {
      "kind": "range",
      "min": 550,
      "max": 600
    },
    "rateText": "550-600 บาท/วัน   หักภาษี 3%",
    "workTime": "จ-พฤ 10.00 - 20.00 น.\nศ-อา 10.00 - 21.00 น.",
    "pcCount": null,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "November2025-C10",
    "name": "ตลาดเสรี พาราไดซ์พาร์ค",
    "dates": "1 - 30 พ.ย. 68",
    "range": {
      "start": "2025-11-01",
      "end": "2025-11-30"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "November2025",
      "rateCell": "C12",
      "ruleCell": "C15"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%",
    "workTime": "08:00 - 20:00 น.",
    "pcCount": null,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 200000,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 200,000 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "November2025-C17",
    "name": "Promenade เดอะ พรอมานาด (2 คน)",
    "dates": "18 - 30 พ.ย. 68",
    "range": {
      "start": "2025-11-18",
      "end": "2025-11-30"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "November2025",
      "rateCell": "C19",
      "ruleCell": "C22"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "November2025-C24",
    "name": "Expo ATM 2025 @สยามพารากอน (2 คน)",
    "dates": "27 - 29 พ.ย. 68",
    "range": {
      "start": "2025-11-27",
      "end": "2025-11-29"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "November2025",
      "rateCell": "C26",
      "ruleCell": "C29"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน   หักภาษี 3%",
    "workTime": "27/11/25 9:00-20:00\n28/11/25 10:00-20:00\n29/11/25 10:00-20:00",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-C3",
    "name": "ตลาดเสรี พาราไดซ์พาร์ค",
    "dates": "1-31 ต.ค. 68",
    "range": {
      "start": "2025-10-01",
      "end": "2025-10-31"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "C5",
      "ruleCell": "C8"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%",
    "workTime": "08:00 - 20:00 น.",
    "pcCount": null,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 200000,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 200,000 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-F3",
    "name": "แฟชั่นไอซ์แลนด์ Sportworld / เก็บเงินเอง (2 คน)",
    "dates": "21 - 29 ต.ค. 68",
    "range": {
      "start": "2025-10-21",
      "end": "2025-10-29"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "F5",
      "ruleCell": "F8"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-I3",
    "name": "ศูนย์ราชการแจ้งวัฒนะ (2 คน)",
    "dates": "24 -28 พ.ย. 68",
    "range": {
      "start": "2025-11-24",
      "end": "2025-11-28"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "I5",
      "ruleCell": "I8"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%",
    "workTime": "08.00 - 19.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-C10",
    "name": "เมกาบางนา (MPR.Anello) / เก็บเงินเอง (2 คน)",
    "dates": "2 - 15 ต.ค. 68",
    "range": {
      "start": "2025-10-02",
      "end": "2025-10-15"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "C12",
      "ruleCell": "C15"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "350,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-F10",
    "name": "เทอร์มินอล 21​ อโศก (2 คน)",
    "dates": "21 ต.ค. - 2 พ.ย. 68",
    "range": {
      "start": "2025-10-21",
      "end": "2025-11-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "F12",
      "ruleCell": "F15"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "500,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-C17",
    "name": "Event เดอะคริสตัล เอกมัย - รามอินทรา (2 คน)",
    "dates": "16 - 26 ต.ค. 68",
    "range": {
      "start": "2025-10-16",
      "end": "2025-10-26"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "C19",
      "ruleCell": "C22"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-F17",
    "name": "เซ็นทรัลลาดพร้าว ชั้น 2 (2 คน)",
    "dates": "23 ต.ค. - 5 พ.ย. 68",
    "range": {
      "start": "2025-10-23",
      "end": "2025-11-05"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "F19",
      "ruleCell": "F22"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-C24",
    "name": "เดอะมอลล์บางกะปิ ชั้น G (2 คน)",
    "dates": "7 - 15 ต.ค. 68",
    "range": {
      "start": "2025-10-07",
      "end": "2025-10-15"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "C26",
      "ruleCell": "C29"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "อาทิตย์ - พฤหัสบดี: 10.00-21.00 น\nศุกร์ เสาร์: กะเช้า 10.00-21.00 น.\nกะบ่าย 11.00-22.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "October2025-F24",
    "name": "งานบ้านและสวน เมืองทอง (2 คน)",
    "dates": "24 ต.ค. - 2 พ.ย. 68",
    "range": {
      "start": "2025-10-24",
      "end": "2025-11-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "October2025",
      "rateCell": "F26",
      "ruleCell": "F29"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "09.30 - 21.00 น.",
    "pcCount": 2,
    "targetText": "1 ล้าน",
    "commission": {
      "kind": "large-event",
      "tiers": [
        [
          1000000,
          0.005
        ],
        [
          1500000,
          0.01
        ]
      ],
      "fixedFrom": 700000,
      "fixedTo": 1000000,
      "perPerson": 500
    },
    "commissionText": "ยอดขาย 7 แสน แต่ไม่ถึง 1 ล้าน คอมมิชชั่น 500 บาท/คน\nยอดขาย 1 ล้าน คอมมิชชั่น 0.5% ตั้งแต่บาทแรก\nยอดขาย 1.5 ล้าน คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2025-C4",
    "name": "งานบ้านและสวน ไบเทคบางนา (3 คน)",
    "dates": "1 - 10 ส.ค. 68",
    "range": {
      "start": "2025-08-01",
      "end": "2025-08-10"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2025",
      "rateCell": "C6",
      "ruleCell": "C9"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "09.30 - 21.00 น.",
    "pcCount": 3,
    "targetText": "1.5 ล้าน",
    "commission": {
      "kind": "bonus-person",
      "tiers": [
        [
          1500000,
          500
        ],
        [
          2000000,
          800
        ],
        [
          2500000,
          1500
        ],
        [
          3000000,
          2000
        ]
      ]
    },
    "commissionText": "1.5 ล้าน โบนัสพิเศษ 500 บาทต่อคน\n2 ล้าน โบนัสพิเศษ 800 บาทต่อคน\n2.5 ล้าน โบนัสพิเศษ 1,500 บาทต่อคน\n3 ล้าน โบนัสพิเศษ 2,000 บาทต่อคน",
    "notes": []
  },
  {
    "id": "August2025-C11",
    "name": "งานบ้านและสวน ไบเทคบางนา (เสาร์-อาทิตย์ 1 คน)",
    "dates": "เสาร์ - อาทิตย์  2 - 3 ส.ค. และ 9 - 10 ส.ค. 68",
    "range": {
      "start": "2025-08-02",
      "end": "2025-08-10"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2025",
      "rateCell": "C13",
      "ruleCell": "C16"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "09.30-21.00 น.",
    "pcCount": 1,
    "targetText": "1.5 ล้าน",
    "commission": {
      "kind": "bonus-person",
      "tiers": [
        [
          1500000,
          200
        ],
        [
          2000000,
          320
        ],
        [
          2500000,
          600
        ],
        [
          3000000,
          800
        ]
      ]
    },
    "commissionText": "1.5 ล้าน โบนัสพิเศษ 200 บาทต่อคน\n2 ล้าน โบนัสพิเศษ 320 บาทต่อคน\n2.5 ล้าน โบนัสพิเศษ 600 บาทต่อคน\n3 ล้าน โบนัสพิเศษ 800 บาทต่อคน",
    "notes": []
  },
  {
    "id": "August2025-C18",
    "name": "แฟชั่นไอซ์แลนด์ Supersports Sale / เก็บเงินเอง (2 คน)",
    "dates": "15 - 24 ส.ค. 68",
    "range": {
      "start": "2025-08-15",
      "end": "2025-08-24"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2025",
      "rateCell": "C20",
      "ruleCell": "C23"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2025-C25",
    "name": "เมกาบางนา (MPR.Anello) / เก็บเงินเอง (2 คน)",
    "dates": "21 ส.ค. - 3 ก.ย. 68",
    "range": {
      "start": "2025-08-21",
      "end": "2025-09-03"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2025",
      "rateCell": "C27",
      "ruleCell": "C30"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 100 บาท)",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "350,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2025-C32",
    "name": "เซ็นทรัลอีสต์วิลล์ Design Village (เกษตร-นวมินทร์) (2 คน)",
    "dates": "22 ส.ค. - 5 ก.ย. 68",
    "range": {
      "start": "2025-08-22",
      "end": "2025-09-05"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2025",
      "rateCell": "C34",
      "ruleCell": "C37"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2025-C39",
    "name": "Terminal Pattaya / เก็บเงินเอง (3 คน)",
    "dates": "26 ส.ค. - 8 ก.ย. 68",
    "range": {
      "start": "2025-08-26",
      "end": "2025-09-08"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2025",
      "rateCell": "C41",
      "ruleCell": "C44"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน   หักภาษี 3%",
    "workTime": "11.00-23.00 น.",
    "pcCount": 3,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2025-C46",
    "name": "เดอะมอลล์บางกะปิ (1 คน)",
    "dates": "14 - 20 ส.ค. 68",
    "range": {
      "start": "2025-08-14",
      "end": "2025-08-20"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2025",
      "rateCell": "C48",
      "ruleCell": "C51"
    },
    "wage": {
      "kind": "calendar",
      "daily": [
        550,
        550,
        550,
        550,
        550,
        625,
        625
      ]
    },
    "rateText": "550-625 บาท/วัน   หักภาษี 3%",
    "workTime": "อาทิตย์ - พฤหัสบดี: 10.00-21.00 น. เรท 550 บาท/วัน\nศุกร์ เสาร์: 10.00-22.00 น. เรท 625 บาท/วัน",
    "pcCount": 1,
    "targetText": "70,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 70000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 70,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "August2025-C53",
    "name": "พารากอน (2 คน)",
    "dates": "14 - 20 ส.ค. 68",
    "range": {
      "start": "2025-08-14",
      "end": "2025-08-20"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "August2025",
      "rateCell": "C55",
      "ruleCell": "C58"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน     หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 200000,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 200,000 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2025-C4",
    "name": "แฟชั่นไอซ์แลนด์ Sportworld ชั้น 1 (2 คน)",
    "dates": "1 - 13 ก.ค. 68",
    "range": {
      "start": "2025-07-01",
      "end": "2025-07-13"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2025",
      "rateCell": "C6",
      "ruleCell": "C9"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "500,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2025-C11",
    "name": "เซ็นทรัลลาดพร้าว ชั้น 2 (2 คน)",
    "dates": "17 - 30 ก.ค. 68",
    "range": {
      "start": "2025-07-17",
      "end": "2025-07-30"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2025",
      "rateCell": "C13",
      "ruleCell": "C16"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "July2025-C18",
    "name": "เดอะมอลล์บางแค (2 คน)",
    "dates": "17 ก.ค. - 6 ส.ค. 68",
    "range": {
      "start": "2025-07-17",
      "end": "2025-08-06"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "July2025",
      "rateCell": "C20",
      "ruleCell": "C23"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "อาทิตย์-จันทร์ 10:00-21:00 น.\nศุกร์-เสาร์ \nกะเช้า 10:00-21:00 น.\nกะบ่าย 11:00-22:00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2025-C2",
    "name": "Event เดอะคริสตัล เอกมัย - รามอินทรา (2 คน)",
    "dates": "9 - 22 มิ.ย. 68",
    "range": {
      "start": "2025-06-09",
      "end": "2025-06-22"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2025",
      "rateCell": "C4",
      "ruleCell": "C7"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2025-C9",
    "name": "Event True Digital Park (2 คน)",
    "dates": "19 - 30 มิ.ย. 68",
    "range": {
      "start": "2025-06-19",
      "end": "2025-06-30"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2025",
      "rateCell": "C11",
      "ruleCell": "C14"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-21.00 น.\nกะบ่าย 11.00-22.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2025-C16",
    "name": "เดอะมอลล์บางแค (2 คน)",
    "dates": "19 - 25 มิ.ย. 68",
    "range": {
      "start": "2025-06-19",
      "end": "2025-06-25"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2025",
      "rateCell": "C18",
      "ruleCell": "C21"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "อาทิตย์-จันทร์ 10:00-21:00 น.\nศุกร์-เสาร์ \nกะเช้า 10:00-21:00 น.\nกะบ่าย 11:00-22:00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2025-C23",
    "name": "เดอะมอลล์บางกะปิ (1 คน)",
    "dates": "23 มิ.ย. - 2 ก.ค. 68",
    "range": {
      "start": "2025-06-23",
      "end": "2025-07-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2025",
      "rateCell": "C25",
      "ruleCell": "C28"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "อาทิตย์ - พฤหัสบดี: 10.00-21.00 น.\nศุกร์ เสาร์: 10.00-22.00 น.",
    "pcCount": 1,
    "targetText": "150,000 บาท (รวมยอดขายตั้งแต่วันที่ 29 พ.ค.- 2 ก.ค.68)",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": [
      "150,000 บาท (รวมยอดขายตั้งแต่วันที่ 29 พ.ค.- 2 ก.ค.68) · ประมาณการนี้ใช้ยอดของงานที่กรอก ยังไม่รวมยอดสะสมรอบอื่น"
    ]
  },
  {
    "id": "June2025-C30",
    "name": "เดอะมอลล์บางกะปิ (1 คน)",
    "dates": "23 มิ.ย. - 2 ก.ค. 68",
    "range": {
      "start": "2025-06-23",
      "end": "2025-07-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2025",
      "rateCell": "C32",
      "ruleCell": "C35"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "อาทิตย์ - พฤหัสบดี: 10.00-21.00 น.\nศุกร์ เสาร์: 10.00-22.00 น.",
    "pcCount": 1,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2025-C37",
    "name": "โรบินสัน จันทบุรี (1 คน)",
    "dates": "19 มิ.ย. - 2 ก.ค. 68",
    "range": {
      "start": "2025-06-19",
      "end": "2025-07-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2025",
      "rateCell": "C39",
      "ruleCell": "C42"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10:00-21:00 น.",
    "pcCount": 1,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2025-C44",
    "name": "เมืองทองธานี sports mall (2 คน)",
    "dates": "24 - 29 มิ.ย. 68",
    "range": {
      "start": "2025-06-24",
      "end": "2025-06-29"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2025",
      "rateCell": "C46",
      "ruleCell": "C49"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "09.30 - 21.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "June2025-C51",
    "name": "เมกาบางนา / เก็บเงินเอง (2 คน)",
    "dates": "3 - 16 ก.ค. 68",
    "range": {
      "start": "2025-07-03",
      "end": "2025-07-16"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "June2025",
      "rateCell": "C53",
      "ruleCell": "C56"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 100 บาท)",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "350,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2025-C7",
    "name": "Event เดอะมอลล์บางกะปิ (2 คน)",
    "dates": "22 - 28 พ.ค. 68",
    "range": {
      "start": "2025-05-22",
      "end": "2025-05-28"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C9",
      "ruleCell": "C12"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00 - 20.00 น.\nกะบ่าย 12.00 - 22.00 น.",
    "pcCount": 2,
    "targetText": "70,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 70000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 70,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2025-C14",
    "name": "Event เมกาบางนา (2 คน)",
    "dates": "15 - 28 พ.ค. 68",
    "range": {
      "start": "2025-05-15",
      "end": "2025-05-28"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C16",
      "ruleCell": "C19"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 100 บาท)",
    "workTime": "10.00-22.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2025-C21",
    "name": "Terminal พระราม3 (2 คน)",
    "dates": "20 พ.ค. - 3 มิ.ย. 68",
    "range": {
      "start": "2025-05-20",
      "end": "2025-06-03"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C23",
      "ruleCell": "C26"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00 - 20.00 น.\nกะบ่าย 12.00 - 22.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2025-C28",
    "name": "บูธ สสว. Outdoor fest 2025 @ศูนย์การประชุมแห่งชาติสิริกิติ์",
    "dates": "22 - 25 พ.ค. 68",
    "range": {
      "start": "2025-05-22",
      "end": "2025-05-25"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C30",
      "ruleCell": "C33"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.30-20.30 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2025-C35",
    "name": "ICONSIAM (1 คน)",
    "dates": "30 เม.ย. - 2 มิ.ย. 68 (34 วัน)",
    "range": {
      "start": "2025-04-30",
      "end": "2025-06-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C37",
      "ruleCell": "C40"
    },
    "wage": null,
    "rateText": "ค่าแรง 372 + โอที 69.75 + เบี้ยขยัน 37.35 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 1,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": [
      "ค่าแรงล่าสุดแจกแจง 372 + OT 69.75 + เบี้ยขยัน 37.35 แต่ชั่วโมง OT ไม่ชัด [ต้องถามเจ้าของ]"
    ]
  },
  {
    "id": "May2025-C42",
    "name": "เดอะมอลล์งามวงศ์วาน (2 คน)",
    "dates": "8-14 พ.ค. 68",
    "range": {
      "start": "2025-05-08",
      "end": "2025-05-14"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C44",
      "ruleCell": "C47"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00 - 20.00 น.\nกะบ่าย 12.00 - 22.00 น./11.00 - 21.00 น.",
    "pcCount": 2,
    "targetText": "70,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 70000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 70,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2025-C49",
    "name": "Event True Digital Park (2 คน)",
    "dates": "19 ก.พ. - 2 มี.ค. 68",
    "range": {
      "start": "2025-02-19",
      "end": "2025-03-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C51",
      "ruleCell": "C54"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-21.00 น.\nกะบ่าย 11.00-22.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2025-C56",
    "name": "เดอะมอลล์โคราช (1 คน)",
    "dates": "22 พ.ค. - 4 มิ.ย. 68",
    "range": {
      "start": "2025-05-22",
      "end": "2025-06-04"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C58",
      "ruleCell": "C61"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน   หักภาษี 3%",
    "workTime": "10:00-21:00 น.",
    "pcCount": 1,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "May2025-C63",
    "name": "บางแสน 42",
    "dates": "23-24 พ.ค. 68",
    "range": {
      "start": "2025-05-23",
      "end": "2025-05-24"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "May2025",
      "rateCell": "C65",
      "ruleCell": ""
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน  (ค่าแรง 600 บาท + เบี้ยขยัน 100 บาท)   หักภาษี 3%",
    "workTime": "วันที่ 23 พ.ค. 68 เวลา 09.30 - 20.00 น.\nวันที่ 24 พ.ค. 68 เวลา 10.00 - 19.00 น.",
    "pcCount": null,
    "targetText": "",
    "commission": null,
    "commissionText": "",
    "notes": []
  },
  {
    "id": "Apr2025-M7",
    "name": "ICONSIAM",
    "dates": "1 เม.ย. - 2 มิ.ย. 68",
    "range": {
      "start": "2025-04-01",
      "end": "2025-06-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Apr2025",
      "rateCell": "M9",
      "ruleCell": "M12"
    },
    "wage": {
      "kind": "flat",
      "amount": 609
    },
    "rateText": "609 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000,
      "monthly": true
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน) ต่อเดือน",
    "notes": [
      "เกณฑ์ระบุคิดต่อเดือน หากงานข้ามเดือนต้องแยกยอดแต่ละเดือน"
    ]
  },
  {
    "id": "Apr2025-M14",
    "name": "เซ็นทรัลลาดพร้าว ชั้น 2 ทางออกพลาซ่า (2 คน)",
    "dates": "11 - 17 เม.ย. 68",
    "range": {
      "start": "2025-04-11",
      "end": "2025-04-17"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Apr2025",
      "rateCell": "M16",
      "ruleCell": "M19"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Apr2025-M21",
    "name": "เซ็นทรัลอีสต์วิลล์ (1 คน)",
    "dates": "11 - 24 เม.ย. 68",
    "range": {
      "start": "2025-04-11",
      "end": "2025-04-24"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Apr2025",
      "rateCell": "M23",
      "ruleCell": "M26"
    },
    "wage": {
      "kind": "range",
      "min": 600,
      "max": 650
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-22.00 น.",
    "pcCount": 1,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": [
      "ตารางสรุป 650 แต่รายละเอียด 600 บาท [ต้องถามเจ้าของ]"
    ]
  },
  {
    "id": "Apr2025-M28",
    "name": "สนามเทพหัสดิน (1 คน)",
    "dates": "11/04/68",
    "range": {
      "start": "2025-04-11",
      "end": "2025-04-11"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Apr2025",
      "rateCell": "M30",
      "ruleCell": "M33"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน   หักภาษี 3%",
    "workTime": "12.00-21.00 น.",
    "pcCount": 1,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000,
      "monthly": true
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน) ต่อเดือน",
    "notes": [
      "เกณฑ์ระบุคิดต่อเดือน หากงานข้ามเดือนต้องแยกยอดแต่ละเดือน"
    ]
  },
  {
    "id": "Mar2025-N9",
    "name": "งานบ้านและสวน ไบเทคบางนา (2 คน)",
    "dates": "22 - 30 มี.ค. 68",
    "range": {
      "start": "2025-03-22",
      "end": "2025-03-30"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Mar2025",
      "rateCell": "N11",
      "ruleCell": "N14"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "09.30 - 21.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Mar2025-N16",
    "name": "Event เมกาบางนา Sportworld",
    "dates": "6 - 19 มี.ค. 68",
    "range": {
      "start": "2025-03-06",
      "end": "2025-03-19"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Mar2025",
      "rateCell": "N18",
      "ruleCell": "N21"
    },
    "wage": {
      "kind": "range",
      "min": 600,
      "max": 650,
      "issue": "เรท 600 บาท แต่ส่วนประกอบ 550 + 100 = 650 บาท [ต้องถามเจ้าของ]"
    },
    "rateText": "600 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 100 บาท)",
    "workTime": "10.00-21.30 น.",
    "pcCount": null,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Mar2025-N23",
    "name": "Event แฟชั่นไอซ์แลนด์ Sportworld ชั้น 3 (2 คน)",
    "dates": "11 - 19 มี.ค. 68",
    "range": {
      "start": "2025-03-11",
      "end": "2025-03-19"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Mar2025",
      "rateCell": "N25",
      "ruleCell": "N28"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Mar2025-N30",
    "name": "เซ็นทรัลแจ้งวัฒนะ (2 คน)",
    "dates": "25 มี.ค. - 8 เม.ย. 68",
    "range": {
      "start": "2025-03-25",
      "end": "2025-04-08"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Mar2025",
      "rateCell": "N32",
      "ruleCell": "N35"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Mar2025-N37",
    "name": "Terminal Pattaya ชั้น G (2 คน)",
    "dates": "25 มี.ค. - 9 เม.ย. 68",
    "range": {
      "start": "2025-03-25",
      "end": "2025-04-09"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Mar2025",
      "rateCell": "N39",
      "ruleCell": "N42"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน   หักภาษี 3%",
    "workTime": "11.00-23.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Feb2025-N7",
    "name": "Event True Digital Park (2 คน)",
    "dates": "19 ก.พ. - 2 มี.ค. 68",
    "range": {
      "start": "2025-02-19",
      "end": "2025-03-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Feb2025",
      "rateCell": "N9",
      "ruleCell": "N12"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-21.00 น.\nกะบ่าย 11.00-22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Feb2025-N14",
    "name": "Event Future park (2 คน)",
    "dates": "26 ก.พ. - 9 มี.ค. 68",
    "range": {
      "start": "2025-02-26",
      "end": "2025-03-09"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Feb2025",
      "rateCell": "N16",
      "ruleCell": "N19"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00 - 20.00 น.\nกะบ่าย 12.00 - 22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Feb2025-N21",
    "name": "Event เดอะคริสตัล เอกมัย - รามอินทรา (2 คน)",
    "dates": "26 ก.พ. - 9 มี.ค. 68",
    "range": {
      "start": "2025-02-26",
      "end": "2025-03-09"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Feb2025",
      "rateCell": "N23",
      "ruleCell": "N26"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Feb2025-N28",
    "name": "Terminal Pattaya ชั้น M",
    "dates": "28 ก.พ. - 11 มี.ค. 68",
    "range": {
      "start": "2025-02-28",
      "end": "2025-03-11"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Feb2025",
      "rateCell": "N30",
      "ruleCell": "N33"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 250 บาท)",
    "workTime": "11.00-23.00 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N14",
    "name": "เดอะคริสตัล เอกมัย - รามอินทรา",
    "dates": "24 ธ.ค. - 5 ม.ค. 68",
    "range": {
      "start": "2024-12-24",
      "end": "2025-01-05"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N16",
      "ruleCell": "N19"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 150 บาท)",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": null,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N21",
    "name": "ลานโปร เมกาบางนา โซนแบงค์",
    "dates": "8 - 22 ม.ค. 68",
    "range": {
      "start": "2025-01-08",
      "end": "2025-01-22"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N23",
      "ruleCell": "N26"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 500 บาท + เบี้ยขยัน 100 บาท)",
    "workTime": "10.00 - 21.30 น.",
    "pcCount": null,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N28",
    "name": "เดอะมอลล์ บางกะปิ",
    "dates": "13 - 22 ม.ค. 68",
    "range": {
      "start": "2025-01-13",
      "end": "2025-01-22"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N30",
      "ruleCell": "N33"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน  หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.00 น.\nกะบ่าย 12.00-22.00 น.",
    "pcCount": null,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N35",
    "name": "เซ็นทรัลลาดพร้าว",
    "dates": "13 - 19 ก.พ. 68",
    "range": {
      "start": "2025-02-13",
      "end": "2025-02-19"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N37",
      "ruleCell": "N40"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 150 บาท)",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": null,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N42",
    "name": "งานวิ่ง จอมบึง",
    "dates": "17 - 18 ม.ค. 68",
    "range": {
      "start": "2025-01-17",
      "end": "2025-01-18"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N44",
      "ruleCell": ""
    },
    "wage": {
      "kind": "flat",
      "amount": 750
    },
    "rateText": "750 บาท/วัน  (ค่าแรง 600 บาท + เบี้ยขยัน 150 บาท)   หักภาษี 3%",
    "workTime": "วันที่ 17 ม.ค. 68 เวลา 09.00 - 18.00 น.\nวันที่ 18 ม.ค. 68 เวลา 09.00 - 19.00 น.",
    "pcCount": null,
    "targetText": "",
    "commission": null,
    "commissionText": "",
    "notes": []
  },
  {
    "id": "Jan2025-N47",
    "name": "แฟชั่นไอซ์แลนด์ /sport world",
    "dates": "17 - 29 ม.ค. 68",
    "range": {
      "start": "2025-01-17",
      "end": "2025-01-29"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N49",
      "ruleCell": "N52"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 150 บาท)",
    "workTime": "10.00 - 21.00 น.",
    "pcCount": null,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N54",
    "name": "Sportworld เมกาบางนา ลาน Fashion Galleria",
    "dates": "22 ม.ค. - 2 ก.พ. 68",
    "range": {
      "start": "2025-01-22",
      "end": "2025-02-02"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N56",
      "ruleCell": "N59"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน\n(ค่าแรง 500 บาท + เบี้ยขยัน 100 บาท)",
    "workTime": "10.00 - 21.30 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N61",
    "name": "เซ็นทรัล เฟสติวัล หาดใหญ่ ชั้น 1",
    "dates": "30 ม.ค. - 12 ก.พ. 68",
    "range": {
      "start": "2025-01-30",
      "end": "2025-02-12"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N63",
      "ruleCell": "N66"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 150 บาท)",
    "workTime": "10.00 - 21.00 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": null,
    "commissionText": "-",
    "notes": []
  },
  {
    "id": "Jan2025-N68",
    "name": "Terminal Pattaya ชั้น M ลานโปรโมชั่น",
    "dates": "31 ม.ค. - 9 ก.พ. 68",
    "range": {
      "start": "2025-01-31",
      "end": "2025-02-09"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N70",
      "ruleCell": "N73"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 250 บาท)",
    "workTime": "11.00-23.00 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N75",
    "name": "โรบินสัน พระราม9 (แทนคนประจำที่เคาน์เตอร์)",
    "dates": "3 - 9 ก.พ. 68",
    "range": {
      "start": "2025-02-03",
      "end": "2025-02-09"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N77",
      "ruleCell": ""
    },
    "wage": {
      "kind": "range",
      "min": 500,
      "max": 600,
      "issue": "10:00–21:00 = 500 บาท; 10:00–22:00 = 600 บาท"
    },
    "rateText": "10.00 - 21.00 น. 500 บาท/วัน\n10.00 - 22.00 น. 600 บาท/วัน\n(หักภาษี3%)",
    "workTime": "",
    "pcCount": null,
    "targetText": "",
    "commission": null,
    "commissionText": "",
    "notes": []
  },
  {
    "id": "Jan2025-N79",
    "name": "เซ็นทรัลบางนา ชั้น 2",
    "dates": "13 - 26 ก.พ. 68",
    "range": {
      "start": "2025-02-13",
      "end": "2025-02-26"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N81",
      "ruleCell": "N84"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 200 บาท)",
    "workTime": "10.00 - 22.00 น.",
    "pcCount": null,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N86",
    "name": "Promenade เดอะ พรอมานาด (2 คน)",
    "dates": "18 - 26 ก.พ. 68",
    "range": {
      "start": "2025-02-18",
      "end": "2025-02-26"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N88",
      "ruleCell": "N91"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Jan2025-N93",
    "name": "โรบินสันฉลอง (2 คน)",
    "dates": "15 - 27 ก.พ. 68",
    "range": {
      "start": "2025-02-15",
      "end": "2025-02-27"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "N95",
      "ruleCell": "N98"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "10.00 - 21.00 น.",
    "pcCount": 2,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Dec2024-N2",
    "name": "เซ็นทรัลลาดพร้าว",
    "dates": "21 ธ.ค. - 5 ม.ค. 68",
    "range": {
      "start": "2024-12-21",
      "end": "2025-01-05"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Dec2024",
      "rateCell": "N4",
      "ruleCell": "N7"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 150 บาท)",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Dec2024-N9",
    "name": "เดอะคริสตัล เอกมัย - รามอินทรา",
    "dates": "24 ธ.ค. - 5 ม.ค. 68",
    "range": {
      "start": "2024-12-24",
      "end": "2025-01-05"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Dec2024",
      "rateCell": "N11",
      "ruleCell": "N14"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 150 บาท)",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": null,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Nov2024-N2",
    "name": "บางแสน 42",
    "dates": "1 - 2 พ.ย. 67",
    "range": {
      "start": "2024-11-01",
      "end": "2024-11-02"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N4",
      "ruleCell": ""
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน  (ค่าแรง 600 บาท + เบี้ยขยัน 100 บาท)   หักภาษี 3%",
    "workTime": "วันที่ 1 พ.ย. 67 เวลา 12.00 - 20.00 น.\nวันที่ 2 พ.ย. 67 เวลา 09.00 - 19.00 น.",
    "pcCount": null,
    "targetText": "",
    "commission": null,
    "commissionText": "",
    "notes": []
  },
  {
    "id": "Nov2024-N7",
    "name": "Outlet Pattaya",
    "dates": "1 - 30 พ.ย. 67",
    "range": {
      "start": "2024-11-01",
      "end": "2024-11-30"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N9",
      "ruleCell": "N12"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน   หักภาษี 3%",
    "workTime": "จ-พฤ 10.00 - 20.00 น.\nศ-อา 10.00 - 21.00 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Nov2024-N14",
    "name": "โรบินสัน บางรัก",
    "dates": "5 - 15 พ.ย. 67",
    "range": {
      "start": "2024-11-05",
      "end": "2024-11-15"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N16",
      "ruleCell": "N19"
    },
    "wage": {
      "kind": "flat",
      "amount": 568
    },
    "rateText": "568 บาท/วัน   หักภาษี 3%",
    "workTime": "10.30 - 21.30 น.",
    "pcCount": null,
    "targetText": "20,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 20000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 20,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก",
    "notes": []
  },
  {
    "id": "Nov2024-N21",
    "name": "Promenade เดอะ พรอมานาด (2 คน)",
    "dates": "14 - 25 พ.ย. 67",
    "range": {
      "start": "2024-11-14",
      "end": "2024-11-25"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N23",
      "ruleCell": "N26"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00 - 20.00 น.\nกะบ่าย 12.00 - 22.00 น.",
    "pcCount": 2,
    "targetText": "150,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Nov2024-N28",
    "name": "เมกาบางนา",
    "dates": "14 - 27 พ.ย. 67",
    "range": {
      "start": "2024-11-14",
      "end": "2024-11-27"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N30",
      "ruleCell": "N33"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 500 บาท + เบี้ยขยัน 100 บาท)",
    "workTime": "10.00 - 21.30 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Nov2024-N35",
    "name": "ไบเทคบางนา",
    "dates": "28 พ.ย. - 1 ธ.ค. 67",
    "range": {
      "start": "2024-11-28",
      "end": "2024-12-01"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N37",
      "ruleCell": "N40"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 550 บาท + เบี้ยขยัน 100 บาท)",
    "workTime": "10.00 - 22.00 น.",
    "pcCount": null,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก",
    "notes": []
  },
  {
    "id": "Nov2024-N48",
    "name": "เมกาบางนา /sportworld",
    "dates": "29 พ.ย. - 8 ธ.ค. 67",
    "range": {
      "start": "2024-11-29",
      "end": "2024-12-08"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N50",
      "ruleCell": "N53"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 500 บาท + เบี้ยขยัน 100 บาท)",
    "workTime": "10.00 - 21.30 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Nov2024-N55",
    "name": "ไบเทคบางนา /sportworld",
    "dates": "28 พ.ย. - 1 ธ.ค. 67",
    "range": {
      "start": "2024-11-28",
      "end": "2024-12-01"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N57",
      "ruleCell": "N60"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 550 บาท + เบี้ยขยัน 100 บาท)",
    "workTime": "10.00 - 22.00 น.",
    "pcCount": null,
    "targetText": "100,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 100000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 100,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Nov2024-N62",
    "name": "เซ็นทรัลลาดพร้าว",
    "dates": "21 ธ.ค. - 5 ม.ค. 67",
    "range": {
      "start": "2023-12-21",
      "end": "2024-01-05"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "N64",
      "ruleCell": "N67"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน      (หักภาษี 3%)\n(ค่าแรง 400 บาท + เบี้ยขยัน 150 บาท)",
    "workTime": "กะเช้า 10.00-20.30 น.\nกะบ่าย 11.30-22.00 น.",
    "pcCount": null,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Oct2024-J12",
    "name": "Terminal พระราม3 (2 คน)",
    "dates": "17 ต.ค. - 13 พ.ย. 67",
    "range": {
      "start": "2024-10-17",
      "end": "2024-11-13"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Oct2024",
      "rateCell": "J14",
      "ruleCell": "J17"
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน   หักภาษี 3%",
    "workTime": "กะเช้า 10.00 - 20.00 น.\nกะบ่าย 12.00 - 22.00 น.",
    "pcCount": 2,
    "targetText": "200,000 บาท",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน 300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Oct2024-J19",
    "name": "Terminal Pattaya (2 คน)",
    "dates": "25 ต.ค. - 3 พ.ย. 67",
    "range": {
      "start": "2024-10-25",
      "end": "2024-11-03"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Oct2024",
      "rateCell": "J21",
      "ruleCell": "J24"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน   หักภาษี 3%",
    "workTime": "11.00 - 23.00 น.",
    "pcCount": 2,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Oct2024-J26",
    "name": "งานบ้านและสวน เมืองทอง Ving (2 คน)",
    "dates": "25 ต.ค. - 3 พ.ย. 67",
    "range": {
      "start": "2024-10-25",
      "end": "2024-11-03"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Oct2024",
      "rateCell": "J28",
      "ruleCell": "J31"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "09.30 - 21.00 น.",
    "pcCount": 2,
    "targetText": "1 ล้าน",
    "commission": {
      "kind": "large-event",
      "tiers": [
        [
          1000000,
          0.005
        ],
        [
          1500000,
          0.01
        ]
      ],
      "fixedFrom": 700000,
      "fixedTo": 1000000,
      "perPerson": 500
    },
    "commissionText": "ยอดขาย 7 แสน แต่ไม่ถึง 1 ล้าน คอมมิชชั่น 500 บาท/คน\nยอดขาย 1 ล้าน คอมมิชชั่น 0.5% ตั้งแต่บาทแรก\nยอดขาย 1.5 ล้าน คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Oct2024-J33",
    "name": "งานบ้านและสวน เมืองทอง Torani (1 คน)",
    "dates": "25 ต.ค. - 3 พ.ย. 67",
    "range": {
      "start": "2024-10-25",
      "end": "2024-11-03"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Oct2024",
      "rateCell": "J35",
      "ruleCell": "J38"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "09.30 - 21.00 น.",
    "pcCount": 1,
    "targetText": "300,000 บาท",
    "commission": {
      "kind": "tiers",
      "tiers": [
        [
          200000,
          0.005
        ],
        [
          300000,
          0.01
        ],
        [
          400000,
          0.015
        ],
        [
          500000,
          0.02
        ]
      ]
    },
    "commissionText": "ยอดขาย 2 แสน บาท คอมมิชชัน 0.5% ตั้งแต่บาทแรก\nยอดขาย 3 แสน บาท คอมมิชชัน 1% ตั้งแต่บาทแรก\nยอดขาย 4 แสน บาท คอมมิชชั่น 1.5% ตั้งแต่บาทแรก\nยอดขาย 5 แสน บาท คอมมิชชั่น 2% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Oct2024-J40",
    "name": "งานบ้านและสวน เมืองทอง Ving (1 คน)",
    "dates": "เสาร์ - อาทิตย์ 26 - 27 ต.ค. และ 2 - 3 พ.ย.67",
    "range": {
      "start": "2024-10-26",
      "end": "2024-11-03"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Oct2024",
      "rateCell": "J42",
      "ruleCell": "J45"
    },
    "wage": {
      "kind": "flat",
      "amount": 700
    },
    "rateText": "700 บาท/วัน     หักภาษี 3%\n(ค่าแรง 550 บาท + ค่าเดินทาง 150 บาท)",
    "workTime": "09.30-21.00 น.",
    "pcCount": 1,
    "targetText": "1 ล้าน",
    "commission": {
      "kind": "large-event",
      "tiers": [
        [
          1000000,
          0.005
        ],
        [
          1500000,
          0.01
        ]
      ],
      "fixedFrom": 700000,
      "fixedTo": 1000000,
      "perPerson": 500
    },
    "commissionText": "ยอดขาย 7 แสน แต่ไม่ถึง 1 ล้าน คอมมิชชั่น 500 บาท/คน\nยอดขาย 1 ล้าน คอมมิชชั่น 0.5% ตั้งแต่บาทแรก\nยอดขาย 1.5 ล้าน คอมมิชชั่น 1% ตั้งแต่บาทแรก\n(คอมมิชชั่นทีม หารกันตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Oct2024-J47",
    "name": "โรบินสัน บางรัก",
    "dates": "31 ต.ค. - 15 พ.ย. 67",
    "range": {
      "start": "2024-10-31",
      "end": "2024-11-15"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Oct2024",
      "rateCell": "J49",
      "ruleCell": "J52"
    },
    "wage": {
      "kind": "flat",
      "amount": 568
    },
    "rateText": "568 บาท/วัน   หักภาษี 3%",
    "workTime": "10.30 - 21.30 น.",
    "pcCount": null,
    "targetText": "50,000 บาท",
    "commission": {
      "kind": "threshold",
      "threshold": 50000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 50,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก",
    "notes": []
  },
  {
    "id": "Sep2024-K29",
    "name": "ลานโปร เมกาบางนา",
    "dates": "3 - 16 ก.ย. 67",
    "range": {
      "start": "2024-09-03",
      "end": "2024-09-16"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Sep2024",
      "rateCell": "K31",
      "ruleCell": "K34"
    },
    "wage": {
      "kind": "flat",
      "amount": 650
    },
    "rateText": "650 บาท/วัน\n(ค่าแรง 550 บาท + ค่าเดินทาง 100 บาท)",
    "workTime": "10.00-22.00 น.",
    "pcCount": null,
    "targetText": "2 แสน",
    "commission": {
      "kind": "excess",
      "first": 150001,
      "upper": 199999,
      "threshold": 200000,
      "rate": 0.015,
      "bonusThreshold": 300000,
      "bonus": 1000
    },
    "commissionText": "ยอดขายมากกว่า 150,001 - 199,999 บาท คอม 1% ตั้งแต่บาทแรก\nยอดขายมากกว่า 200,000 บาท คอม 1.5% จากยอดที่เกิน\nหากเป้าเกิน300,000 โบนัสทะลุเป้า 1,000\n(คอมมิชชั่นและโบนัสทีม หากมี PC มากกว่า 1 คน หารเท่าตามจำนวนคน)",
    "notes": []
  },
  {
    "id": "Sep2024-K36",
    "name": "เดอะมอลล์ บางกะปิ",
    "dates": "11 - 16 ต.ค. 67",
    "range": {
      "start": "2024-10-11",
      "end": "2024-10-16"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Sep2024",
      "rateCell": "K38",
      "ruleCell": "K40"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน  หักภาษี 3%",
    "workTime": "10.00 - 21.00 น.",
    "pcCount": null,
    "targetText": "",
    "commission": {
      "kind": "threshold",
      "threshold": 70000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 70,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก",
    "notes": []
  },
  {
    "id": "Sep2024-K42",
    "name": "เดอะมอลล์ งามวงศ์วาน",
    "dates": "17 - 24 ต.ค. 67",
    "range": {
      "start": "2024-10-17",
      "end": "2024-10-24"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Sep2024",
      "rateCell": "K44",
      "ruleCell": ""
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน  หักภาษี 3%",
    "workTime": "10.00 - 21.00 น.",
    "pcCount": null,
    "targetText": "",
    "commission": null,
    "commissionText": "",
    "notes": []
  },
  {
    "id": "Sep2024-K47",
    "name": "เซ็นทรัลพระราม2 ฝั่ง Department",
    "dates": "28 ก.ย. - 1 ต.ค. 67",
    "range": {
      "start": "2024-09-28",
      "end": "2024-10-01"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Sep2024",
      "rateCell": "K49",
      "ruleCell": ""
    },
    "wage": {
      "kind": "flat",
      "amount": 500
    },
    "rateText": "500 บาท/วัน  หักภาษี 3%",
    "workTime": "11.00 - 21.00 น.",
    "pcCount": null,
    "targetText": "",
    "commission": null,
    "commissionText": "",
    "notes": []
  },
  {
    "id": "Sep2024-K52",
    "name": "พารากอน",
    "dates": "2 - 15 ต.ค. 67",
    "range": {
      "start": "2024-10-02",
      "end": "2024-10-15"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Sep2024",
      "rateCell": "K54",
      "ruleCell": "K56"
    },
    "wage": {
      "kind": "flat",
      "amount": 600
    },
    "rateText": "600 บาท/วัน  หักภาษี 3%",
    "workTime": "10.00 - 22.00 น.",
    "pcCount": null,
    "targetText": "",
    "commission": {
      "kind": "threshold",
      "threshold": 90000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 90,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก",
    "notes": []
  },
  {
    "id": "Sep2024-K58",
    "name": "เซ็นทรัล สีลมคอมเพลกซ์ ฝั่ง Department",
    "dates": "12 - 25 ต.ค. 67",
    "range": {
      "start": "2024-10-12",
      "end": "2024-10-25"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Sep2024",
      "rateCell": "K60",
      "ruleCell": "K62"
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน  หักภาษี 3%",
    "workTime": "10.30 - 21.00 น.",
    "pcCount": null,
    "targetText": "",
    "commission": {
      "kind": "threshold",
      "threshold": 80000,
      "rate": 0.01
    },
    "commissionText": "ยอดขายมากกว่า 80,000 บาท คอมมิชชั่น 1% ตั้งแต่บาทแรก",
    "notes": []
  },
  {
    "id": "Apr2025-B6",
    "name": "Style bangkok 2025 ศูนย์สิริกิติ์",
    "dates": "5 - 6 เม.ย. 68",
    "range": {
      "start": "2025-04-05",
      "end": "2025-04-06"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Apr2025",
      "rateCell": "E6",
      "ruleCell": ""
    },
    "wage": {
      "kind": "flat",
      "amount": 550
    },
    "rateText": "550 บาท/วัน",
    "workTime": "10.00-21.00 น.",
    "pcCount": 2,
    "targetText": "-",
    "commission": null,
    "commissionText": "",
    "notes": []
  },
  {
    "id": "Nov2024-B13",
    "name": "บางแสน21",
    "dates": "13 - 14 ธ.ค. 67",
    "range": {
      "start": "2024-12-13",
      "end": "2024-12-14"
    },
    "year": 2024,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Nov2024",
      "rateCell": "F13",
      "ruleCell": ""
    },
    "wage": {
      "kind": "flat",
      "amount": 800
    },
    "rateText": "800",
    "workTime": "วันที่ 13 ธ.ค. 67 เวลา 11.00 – 20.00 น.  \nวันที่ 14 ธ.ค. 67 เวลา 10.00 – 19.00 น.",
    "pcCount": 2,
    "targetText": "100000.0",
    "commission": null,
    "commissionText": "",
    "notes": []
  },
  {
    "id": "Jan2025-B7",
    "name": "งานวิ่ง บุรีรัมย์มาราธอน2025",
    "dates": "24 - 25 ม.ค. 68",
    "range": {
      "start": "2025-01-24",
      "end": "2025-01-25"
    },
    "year": 2025,
    "source": {
      "file": "เรทEvent.xlsx",
      "sheet": "Jan2025",
      "rateCell": "F7",
      "ruleCell": ""
    },
    "wage": null,
    "rateText": "",
    "workTime": "09.30 - 20.00 น.",
    "pcCount": 2,
    "targetText": "-",
    "commission": null,
    "commissionText": "",
    "notes": []
  }
];
