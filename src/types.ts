// ทุกหน่วยเป็น "เมตร" (m) — พื้นที่คำนวณเป็น ตร.ม. (m²)
export type RoomKind = 'room' | 'stairs'

export type Room = {
  id: string
  name: string
  x: number // มุมซ้ายบน (เมตร) จากมุมซ้ายบนของโรงงาน
  y: number
  w: number // กว้าง (เมตร)
  h: number // ยาว/ลึก (เมตร)
  color: string
  kind?: RoomKind // ชนิด: ห้องปกติ หรือ บันได (ค่าเริ่มต้น = room)
  locked?: boolean // ล็อกตำแหน่ง: ลาก/ปรับขนาดไม่ได้
  floor?: number // ชั้น (1 หรือ 2); ค่าเริ่มต้น = 1
}

export type Plan = {
  // ขนาดขอบเขตโรงงาน (เมตร)
  factoryW: number
  factoryH: number
  // ระยะกริด (เมตร) — เสา X และ แถว Y ของโรงงาน ใช้ทั้งวาดเส้นและ snap
  gridX: number
  gridY: number
  rooms: Room[]
}

// จำนวนตำแหน่งจับสำหรับปรับขนาด (มุม 4 + ขอบ 4)
export type HandleDir =
  | 'nw' | 'n' | 'ne'
  | 'w'  |       'e'
  | 'sw' | 's' | 'se'
