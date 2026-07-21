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
