import type { Plan, Room } from './types'

// เลย์เอาต์ร่างจากแบบแปลนโรงงาน (Tokura)
// กริด: เสา X = 5.5 ม. (12 ช่อง = 66 ม.), แถว Y = 5.2 ม. (9 ช่อง = 46.8 ม.)
// ทุกห้องวางเป็น "ช่องกริด" พอดี (col/row + จำนวนช่อง) — ปรับลากได้ตามจริง
const GX = 5.5
const GY = 5.2

const C = {
  office: '#dbeafe',
  restroom: '#ddd6fe',
  canteen: '#fef3c7',
  util: '#e2e8f0',
  fullfill: '#d1fae5',
  cold: '#bae6fd',
  freeze: '#a5f3fc',
  infect: '#fed7aa',
  raw: '#fde68a',
  mix: '#fecaca',
  pkgstore: '#c7d2fe',
  pack: '#bbf7d0',
  carton: '#fbcfe8',
  manual: '#f9a8d4',
  stock: '#fed7aa',
  loading: '#fde68a',
  lineA: '#fecaca',
  lineB: '#fecdd3',
  buffer: '#fef9c3',
  system: '#e5e7eb',
}

// helper: วางห้องด้วยพิกัดช่องกริด (col, row = เริ่มจาก 0; cs, rs = จำนวนช่อง)
type Cell = { id: string; name: string; col: number; row: number; cs: number; rs: number; color: string; kind?: Room['kind']; locked?: boolean }
function cell(c: Cell): Room {
  return {
    id: c.id, name: c.name, color: c.color, kind: c.kind, locked: c.locked, floor: 1,
    x: +(c.col * GX).toFixed(2), y: +(c.row * GY).toFixed(2),
    w: +(c.cs * GX).toFixed(2), h: +(c.rs * GY).toFixed(2),
  }
}

const CELLS: Cell[] = [
  // ===== สำนักงาน / สวัสดิการ (ซ้าย, col 0-3, row 0-2) =====
  { id: 'o1', name: 'FIRST AID', col: 0, row: 0, cs: 1, rs: 1, color: C.office },
  { id: 'o2', name: 'INTERVIEW', col: 0, row: 1, cs: 1, rs: 1, color: C.office },
  { id: 'o3', name: 'RECEPTION (+800)', col: 0, row: 2, cs: 1, rs: 1, color: C.office },
  { id: 'o4', name: 'CANTEEN 50 SEATS', col: 1, row: 0, cs: 2, rs: 1, color: C.canteen },
  { id: 'o5', name: 'สูบบุหรี่', col: 3, row: 0, cs: 1, rs: 1, color: C.util },
  { id: 'o6', name: 'RESTROOM (M)', col: 1, row: 1, cs: 1, rs: 1, color: C.restroom },
  { id: 'o7', name: 'RESTROOM (W)', col: 2, row: 1, cs: 1, rs: 1, color: C.restroom },
  { id: 'o8', name: 'CHANGING AREA', col: 1, row: 2, cs: 1, rs: 1, color: C.carton },
  { id: 'o9', name: 'DARK ROOM (Check point)', col: 2, row: 2, cs: 1, rs: 1, color: C.util },
  { id: 'o10', name: 'AIR SHOWER', col: 3, row: 2, cs: 1, rs: 1, color: C.util },

  // ===== กลางบน: AIR LOCK / FULLFILLMENT / ห้องเย็น / MIX / RAW =====
  { id: 'c1', name: 'AIR LOCK (ไม่เอา)', col: 4, row: 0, cs: 1, rs: 1, color: C.util },
  { id: 'c2', name: 'FULLFILLMENT', col: 4, row: 1, cs: 1, rs: 2, color: C.fullfill },
  { id: 'c3', name: 'ห้องเย็น -4°C เนย/มะพร้าว', col: 5, row: 1, cs: 2, rs: 1, color: C.cold },
  { id: 'c4', name: 'ห้องฟรีซ -18°C สับปะรด/ทุเรียน', col: 5, row: 2, cs: 1, rs: 1, color: C.freeze },
  { id: 'c5', name: 'INFECTION TESTING ROOM', col: 6, row: 2, cs: 1, rs: 1, color: C.infect },
  { id: 's1', name: 'บันได / ลิฟต์', col: 7, row: 1, cs: 1, rs: 1, color: '#cbd5e1', kind: 'stairs', locked: true },
  { id: 'c6', name: 'RAW MATERIAL (Allergen)', col: 8, row: 0, cs: 2, rs: 2, color: C.raw },
  { id: 'c7', name: 'MIX 1 (รางระบายน้ำ)', col: 8, row: 2, cs: 1, rs: 1, color: C.mix },
  { id: 'c8', name: 'MIX 2 (รางระบายน้ำ)', col: 9, row: 2, cs: 1, rs: 1, color: C.mix },

  // ===== กลาง: จัดเก็บ / แพ็ค (row 3-8) =====
  { id: 'p1', name: 'PACKAGING STORE', col: 0, row: 3, cs: 2, rs: 2, color: C.pkgstore },
  { id: 'p2', name: 'ห้องพักงาน Store', col: 2, row: 3, cs: 1, rs: 2, color: C.pkgstore },
  { id: 'p3', name: 'FORMING CARTON', col: 3, row: 3, cs: 1, rs: 2, color: C.carton },
  { id: 'p4', name: 'PACKING 2', col: 4, row: 3, cs: 3, rs: 2, color: C.pack },
  { id: 'p5', name: 'PACK CARTON', col: 5, row: 5, cs: 1, rs: 3, color: C.carton },
  { id: 'p6', name: 'PACKING 1', col: 6, row: 5, cs: 2, rs: 2, color: C.pack },
  { id: 'p7', name: 'WRAP PALLET', col: 5, row: 8, cs: 1, rs: 1, color: C.manual },
  { id: 'p8', name: 'WRAP PALLET / PACK MANUAL', col: 6, row: 7, cs: 2, rs: 2, color: C.manual },

  // ===== คลังสินค้า (ซ้ายล่าง) =====
  { id: 'w1', name: 'STOCK FINISH GOOD (GL+200)', col: 0, row: 5, cs: 5, rs: 3, color: C.stock },
  { id: 'w2', name: 'LOADING AREA (GL+1,300)', col: 0, row: 8, cs: 5, rs: 1, color: C.loading },

  // ===== ไลน์ผลิต (ขวา, col 8-9) =====
  { id: 'l1', name: 'PRODUCTION LINE B (AUTOMATION)', col: 8, row: 3, cs: 2, rs: 1, color: C.lineB },
  { id: 'l2', name: 'PRODUCTION LINE A (OLD ROLL)', col: 8, row: 4, cs: 2, rs: 1, color: C.lineA },
  { id: 'l3', name: 'buffer ทองม้วน / น้ำแป้ง', col: 8, row: 5, cs: 2, rs: 1, color: C.buffer },
  { id: 'l4', name: 'PRODUCTION LINE C (COATING)', col: 8, row: 6, cs: 2, rs: 1, color: C.lineB },
  { id: 'l5', name: 'PRODUCTION LINE D (BAKERY)', col: 8, row: 7, cs: 2, rs: 2, color: C.lineA },

  // ===== ระบบ / งานระบบ (ขวาสุด, col 10-11) =====
  { id: 'u1', name: 'MAINTENANCE / ELECTRICAL', col: 10, row: 3, cs: 2, rs: 1, color: C.util },
  { id: 'u2', name: 'EQUIP CLEAN / LAUNDRY', col: 10, row: 4, cs: 2, rs: 1, color: C.util },
  { id: 'u3', name: 'CASE COOLING SYSTEM', col: 10, row: 5, cs: 2, rs: 1, color: C.system },
  { id: 'u4', name: 'RO WATER SYSTEM', col: 10, row: 6, cs: 2, rs: 1, color: C.system },
  { id: 'u5', name: 'WATER TANK', col: 10, row: 7, cs: 2, rs: 1, color: C.cold },
  { id: 'u6', name: 'MDB.', col: 10, row: 8, cs: 1, rs: 1, color: C.util },
  { id: 'u7', name: 'CLEAN RM.', col: 11, row: 8, cs: 1, rs: 1, color: C.system },
]

export const SEED_PLAN: Plan = {
  factoryW: 66,
  factoryH: 46.8,
  gridX: GX,
  gridY: GY,
  rooms: CELLS.map(cell),
}
