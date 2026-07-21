import type { Room, Rect } from './types'

// สี่เหลี่ยมย่อยของห้อง (ห้องเดี่ยว = 1 ชิ้น, ห้องประกอบ = หลายชิ้น)
export function partsOf(r: Room): Rect[] {
  return r.parts && r.parts.length ? r.parts : [{ x: r.x, y: r.y, w: r.w, h: r.h }]
}

// พื้นที่จริงของห้อง (รวมทุกชิ้น) — ห้องประกอบใช้ค่านี้ ไม่ใช่ w×h ของกรอบนอก
export function roomArea(r: Room): number {
  return partsOf(r).reduce((s, p) => s + p.w * p.h, 0)
}

export function bboxOf(parts: Rect[]): Rect {
  const x = Math.min(...parts.map((p) => p.x))
  const y = Math.min(...parts.map((p) => p.y))
  const x2 = Math.max(...parts.map((p) => p.x + p.w))
  const y2 = Math.max(...parts.map((p) => p.y + p.h))
  return { x: +x.toFixed(2), y: +y.toFixed(2), w: +(x2 - x).toFixed(2), h: +(y2 - y).toFixed(2) }
}

// ค่าซูม (พิกเซลต่อเมตร)
export const SCALE_MIN = 3
export const SCALE_MAX = 100

export function clampScale(s: number): number {
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, s))
}

// แปลงพิกัดหน้าจอ (clientX/Y) -> เมตรในระบบพิกัดของ SVG
export function metersFromClient(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = new DOMPointReadOnly(clientX, clientY).matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

// แปลงเมตร -> พิกัดหน้าจอ (clientX/Y)
export function clientFromMeters(svg: SVGSVGElement, mx: number, my: number) {
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = new DOMPointReadOnly(mx, my).matrixTransform(ctm)
  return { x: p.x, y: p.y }
}
