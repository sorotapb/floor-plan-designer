import { useEffect, useLayoutEffect, useRef } from 'react'
import type { Room, HandleDir } from './types'
import { clampScale, clientFromMeters, metersFromClient } from './geometry'

const PAD = 3 // ระยะขอบรอบโรงงาน (เมตร) เผื่อไว้ใส่ไม้บรรทัด/ป้าย
const HANDLE_PX = 9 // ขนาดจุดจับ (พิกเซล)
const MIN_SIZE = 0.5 // ขนาดห้องเล็กสุด (เมตร)

type Props = {
  factoryW: number
  factoryH: number
  gridX: number // ระยะกริดแนวนอน (เมตร) — เสา
  gridY: number // ระยะกริดแนวตั้ง (เมตร) — แถว
  subdiv: number // จำนวนช่องย่อยต่อ 1 ช่องกริด (วาดเส้นย่อย)
  rooms: Room[]
  activeFloor: number // ชั้นที่กำลังแก้ไข
  selectedId: string | null
  scale: number // พิกเซลต่อเมตร
  snapX: number // ระยะ snap แกน X (เมตร); 0 = ไม่ snap
  snapY: number // ระยะ snap แกน Y (เมตร); 0 = ไม่ snap
  fitSignal: number // เพิ่มค่าเพื่อสั่ง "พอดีจอ"
  onSelect: (id: string | null) => void
  onChangeRoom: (id: string, patch: Partial<Room>) => void
  onScaleChange: (scale: number) => void
}

type Drag =
  | { kind: 'move'; id: string; startX: number; startY: number; ox: number; oy: number }
  | {
      kind: 'resize'
      id: string
      dir: HandleDir
      startX: number
      startY: number
      ox: number
      oy: number
      ow: number
      oh: number
    }

const HANDLES: { dir: HandleDir; cursor: string }[] = [
  { dir: 'nw', cursor: 'nwse-resize' },
  { dir: 'n', cursor: 'ns-resize' },
  { dir: 'ne', cursor: 'nesw-resize' },
  { dir: 'w', cursor: 'ew-resize' },
  { dir: 'e', cursor: 'ew-resize' },
  { dir: 'sw', cursor: 'nesw-resize' },
  { dir: 's', cursor: 'ns-resize' },
  { dir: 'se', cursor: 'nwse-resize' },
]

function handlePos(r: Room, dir: HandleDir): { cx: number; cy: number } {
  const midX = r.x + r.w / 2
  const midY = r.y + r.h / 2
  const left = r.x
  const right = r.x + r.w
  const top = r.y
  const bottom = r.y + r.h
  switch (dir) {
    case 'nw': return { cx: left, cy: top }
    case 'n': return { cx: midX, cy: top }
    case 'ne': return { cx: right, cy: top }
    case 'w': return { cx: left, cy: midY }
    case 'e': return { cx: right, cy: midY }
    case 'sw': return { cx: left, cy: bottom }
    case 's': return { cx: midX, cy: bottom }
    case 'se': return { cx: right, cy: bottom }
  }
}

export default function FloorPlanCanvas({
  factoryW,
  factoryH,
  gridX,
  gridY,
  subdiv,
  rooms,
  activeFloor,
  selectedId,
  scale,
  snapX,
  snapY,
  fitSignal,
  onSelect,
  onChangeRoom,
  onScaleChange,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)

  // สำหรับซูม: จุดยึด (เมตร) ที่ต้องคงตำแหน่งบนจอหลังเปลี่ยน scale
  const cursorAnchor = useRef<{ mx: number; my: number; cx: number; cy: number } | null>(null)
  const centerMeter = useRef<{ mx: number; my: number } | null>(null)
  const scaleRef = useRef(scale)
  scaleRef.current = scale
  const onScaleRef = useRef(onScaleChange)
  onScaleRef.current = onScaleChange

  const vbW = factoryW + PAD * 2
  const vbH = factoryH + PAD * 2
  const pxW = vbW * scale
  const pxH = vbH * scale

  function snapX_(v: number): number {
    if (!snapX) return Math.round(v * 100) / 100
    return +(Math.round(v / snapX) * snapX).toFixed(2)
  }
  function snapY_(v: number): number {
    if (!snapY) return Math.round(v * 100) / 100
    return +(Math.round(v / snapY) * snapY).toFixed(2)
  }

  function toMeters(clientX: number, clientY: number) {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    return metersFromClient(svg, clientX, clientY)
  }

  // จำจุดกึ่งกลาง viewport (เมตร) ไว้ เพื่อให้ปุ่มซูมซูมเข้าหากลางจอ
  function rememberCenter() {
    const svg = svgRef.current
    const scroll = scrollRef.current
    if (!svg || !scroll) return
    const rect = scroll.getBoundingClientRect()
    const m = metersFromClient(svg, rect.left + scroll.clientWidth / 2, rect.top + scroll.clientHeight / 2)
    centerMeter.current = { mx: m.x, my: m.y }
  }

  // หลังเปลี่ยน scale: เลื่อน scroll ให้จุดยึดคงอยู่ที่เดิมบนจอ
  useLayoutEffect(() => {
    const svg = svgRef.current
    const scroll = scrollRef.current
    if (!svg || !scroll) return
    let anchor = cursorAnchor.current
    cursorAnchor.current = null
    if (!anchor) {
      const c = centerMeter.current
      if (!c) return
      const rect = scroll.getBoundingClientRect()
      anchor = { mx: c.mx, my: c.my, cx: rect.left + scroll.clientWidth / 2, cy: rect.top + scroll.clientHeight / 2 }
    }
    const scr = clientFromMeters(svg, anchor.mx, anchor.my)
    scroll.scrollLeft += scr.x - anchor.cx
    scroll.scrollTop += scr.y - anchor.cy
  }, [scale])

  // ซูมด้วย pinch (trackpad) หรือ ⌘/Ctrl + ล้อเมาส์ — ซูมเข้าหาตำแหน่งเคอร์เซอร์
  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return // ล้อธรรมดา = เลื่อนจอ
      e.preventDefault()
      const svg = svgRef.current
      if (!svg) return
      const m = metersFromClient(svg, e.clientX, e.clientY)
      cursorAnchor.current = { mx: m.x, my: m.y, cx: e.clientX, cy: e.clientY }
      const factor = Math.exp(-e.deltaY * 0.0016)
      onScaleRef.current(clampScale(scaleRef.current * factor))
    }
    scroll.addEventListener('wheel', onWheel, { passive: false })
    return () => scroll.removeEventListener('wheel', onWheel)
  }, [])

  // ปุ่ม "พอดีจอ"
  useEffect(() => {
    if (fitSignal === 0) return
    const scroll = scrollRef.current
    if (!scroll) return
    const availW = scroll.clientWidth - 24
    const availH = scroll.clientHeight - 24
    const s = clampScale(Math.min(availW / vbW, availH / vbH))
    centerMeter.current = { mx: factoryW / 2, my: factoryH / 2 }
    cursorAnchor.current = null
    onScaleRef.current(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitSignal])

  function onPointerMove(e: PointerEvent) {
    const d = dragRef.current
    if (!d) return
    const m = toMeters(e.clientX, e.clientY)
    const dx = m.x - d.startX
    const dy = m.y - d.startY

    if (d.kind === 'move') {
      onChangeRoom(d.id, { x: snapX_(d.ox + dx), y: snapY_(d.oy + dy) })
      return
    }

    // resize
    let { ox: x, oy: y, ow: w, oh: h } = d
    const dir = d.dir
    if (dir.includes('e')) w = d.ow + dx
    if (dir.includes('s')) h = d.oh + dy
    if (dir.includes('w')) {
      w = d.ow - dx
      x = d.ox + dx
    }
    if (dir.includes('n')) {
      h = d.oh - dy
      y = d.oy + dy
    }

    // snap ตามขอบที่กำลังลาก (ขอบให้ลงกริด)
    if (dir.includes('e')) w = snapX_(d.ox + w) - d.ox
    if (dir.includes('s')) h = snapY_(d.oy + h) - d.oy
    if (dir.includes('w')) {
      const nx = snapX_(x)
      w = w + (x - nx)
      x = nx
    }
    if (dir.includes('n')) {
      const ny = snapY_(y)
      h = h + (y - ny)
      y = ny
    }

    if (w < MIN_SIZE) {
      if (dir.includes('w')) x = d.ox + d.ow - MIN_SIZE
      w = MIN_SIZE
    }
    if (h < MIN_SIZE) {
      if (dir.includes('n')) y = d.oy + d.oh - MIN_SIZE
      h = MIN_SIZE
    }

    onChangeRoom(d.id, {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      w: Math.round(w * 100) / 100,
      h: Math.round(h * 100) / 100,
    })
  }

  function endDrag() {
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', endDrag)
  }

  function startMove(e: React.PointerEvent, r: Room) {
    e.stopPropagation()
    onSelect(r.id)
    if (r.locked) return // ล็อกอยู่ — เลือกได้แต่ลากไม่ได้
    const m = toMeters(e.clientX, e.clientY)
    dragRef.current = { kind: 'move', id: r.id, startX: m.x, startY: m.y, ox: r.x, oy: r.y }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
  }

  function startResize(e: React.PointerEvent, r: Room, dir: HandleDir) {
    e.stopPropagation()
    onSelect(r.id)
    if (r.locked) return
    const m = toMeters(e.clientX, e.clientY)
    dragRef.current = {
      kind: 'resize',
      id: r.id,
      dir,
      startX: m.x,
      startY: m.y,
      ox: r.x,
      oy: r.y,
      ow: r.w,
      oh: r.h,
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
  }

  // เส้นกริด: เส้นย่อย (gridX/subdiv) จาง + เส้นเสาหลัก (gridX) หนา
  const gx = gridX > 0.1 ? gridX : 5.5
  const gy = gridY > 0.1 ? gridY : 5.2
  const sd = subdiv >= 1 ? subdiv : 1
  const fx = gx / sd
  const fy = gy / sd
  const gridLines: React.ReactElement[] = []
  const modX: number[] = [] // เส้นเสาหลัก (ใช้ทำไม้บรรทัดด้วย)
  const modY: number[] = []
  for (let x = 0; x <= factoryW + 0.001; x += gx) modX.push(+x.toFixed(2))
  for (let y = 0; y <= factoryH + 0.001; y += gy) modY.push(+y.toFixed(2))
  // เส้นย่อย
  for (let x = fx, i = 0; x < factoryW - 0.001; x += fx, i++) {
    if (Math.abs(x / gx - Math.round(x / gx)) < 0.001) continue // ข้ามเส้นที่ตรงกับเสาหลัก
    gridLines.push(<line key={`fx${i}`} x1={x} y1={0} x2={x} y2={factoryH} stroke="#eef2f7" strokeWidth={0.35 / scale} />)
  }
  for (let y = fy, i = 0; y < factoryH - 0.001; y += fy, i++) {
    if (Math.abs(y / gy - Math.round(y / gy)) < 0.001) continue
    gridLines.push(<line key={`fy${i}`} x1={0} y1={y} x2={factoryW} y2={y} stroke="#eef2f7" strokeWidth={0.35 / scale} />)
  }
  // เส้นเสาหลัก
  modX.forEach((x, i) => gridLines.push(<line key={`mx${i}`} x1={x} y1={0} x2={x} y2={factoryH} stroke="#c9d3e0" strokeWidth={0.7 / scale} />))
  modY.forEach((y, i) => gridLines.push(<line key={`my${i}`} x1={0} y1={y} x2={factoryW} y2={y} stroke="#c9d3e0" strokeWidth={0.7 / scale} />))
  const xLines = modX
  const yLines = modY

  const handleSize = HANDLE_PX / scale
  const dimFont = Math.min(1.3, 11 / scale)

  const activeRooms = rooms.filter((r) => (r.floor ?? 1) === activeFloor)
  const ghostRooms = rooms.filter((r) => (r.floor ?? 1) !== activeFloor)

  // ลายบันได (ขั้นบันได + ลูกศรขึ้น)
  function stairSteps(r: Room): React.ReactElement[] {
    const els: React.ReactElement[] = []
    const along = Math.max(r.w, r.h)
    const n = Math.max(3, Math.round(along / 0.5))
    const sw = 0.9 / scale
    if (r.h >= r.w) {
      for (let i = 1; i < n; i++) {
        const yy = r.y + (r.h * i) / n
        els.push(<line key={`s${i}`} x1={r.x} y1={yy} x2={r.x + r.w} y2={yy} stroke="#a9b6c6" strokeWidth={sw} />)
      }
    } else {
      for (let i = 1; i < n; i++) {
        const xx = r.x + (r.w * i) / n
        els.push(<line key={`s${i}`} x1={xx} y1={r.y} x2={xx} y2={r.y + r.h} stroke="#a9b6c6" strokeWidth={sw} />)
      }
    }
    return els
  }

  // คำนวณฟอนต์ให้ชื่อ+ขนาด พอดีในกล่อง (ย่ออัตโนมัติ ไม่ล้นออกนอกกล่อง)
  function labelLayout(r: Room) {
    const CW = 0.62 // สัดส่วนความกว้างตัวอักษรต่อขนาดฟอนต์ (เผื่อภาษาไทย)
    const MAX = 1.35 // ฟอนต์ชื่อใหญ่สุด (เมตร)
    const availW = Math.max(0.1, r.w * 0.9)
    const availH = Math.max(0.1, r.h * 0.86)
    const name = (r.locked ? '🔒 ' : '') + r.name
    const dim = `${r.w.toFixed(2)} × ${r.h.toFixed(2)} = ${(r.w * r.h).toFixed(1)} ตร.ม.`
    const heightCap = availH / 2.15 // สองบรรทัด
    const nameWCap = availW / (name.length * CW)
    let fName = Math.min(MAX, heightCap, nameWCap)
    let fDim = Math.min(fName * 0.8, availW / (dim.length * CW))
    let bh = fName + fName * 0.16 + fDim
    if (bh > availH) { const k = availH / bh; fName *= k; fDim *= k }
    const gap = fName * 0.16
    bh = fName + gap + fDim
    const cx = r.x + r.w / 2
    const top = r.y + r.h / 2 - bh / 2
    const nameY = top + fName * 0.82
    const dimY = top + fName + gap + fDim * 0.82
    // ล็อกความกว้างไม่ให้ล้น เมื่อข้อความยาวจนถูกจำกัดด้วยความกว้าง
    const nameLen = nameWCap <= Math.min(MAX, heightCap) ? availW : undefined
    const dimLen = dim.length * CW * fDim > availW ? availW : undefined
    return { name, dim, fName, fDim, cx, nameY, dimY, nameLen, dimLen }
  }

  return (
    <div className="scroll" ref={scrollRef} onScroll={rememberCenter}>
      <div className="canvas-wrap">
        <svg
          ref={svgRef}
          width={pxW}
          height={pxH}
          viewBox={`${-PAD} ${-PAD} ${vbW} ${vbH}`}
          onPointerDown={() => onSelect(null)}
          style={{ touchAction: 'none' }}
        >
          <rect x={0} y={0} width={factoryW} height={factoryH} fill="#ffffff" stroke="none" />
          <g>{gridLines}</g>

          {/* ไม้บรรทัด — ป้ายที่เส้นกริดจริง */}
          {xLines.map((x, i) => (
            <text key={`tx${i}`} x={x} y={-0.7} fontSize={dimFont} textAnchor="middle" fill="#94a3b8">
              {x % 1 === 0 ? x : x.toFixed(1)}
            </text>
          ))}
          {yLines.map((y, i) => (
            <text key={`ty${i}`} x={-0.7} y={y + dimFont / 3} fontSize={dimFont} textAnchor="end" fill="#94a3b8">
              {y % 1 === 0 ? y : y.toFixed(1)}
            </text>
          ))}

          {/* เงาห้องของชั้นอื่น (อ้างอิงการจัดวาง) */}
          {ghostRooms.map((r) => (
            <g key={`ghost-${r.id}`} style={{ pointerEvents: 'none' }}>
              <rect
                x={r.x} y={r.y} width={r.w} height={r.h}
                fill={r.color} fillOpacity={0.12}
                stroke="#cbd5e1" strokeWidth={0.5 / scale} strokeDasharray={`${0.5} ${0.4}`}
              />
              {r.h * scale > 10 && (
                <text
                  x={r.x + r.w / 2} y={r.y + r.h / 2 + dimFont * 0.35}
                  fontSize={Math.min(dimFont, (r.w * 0.9) / (r.name.length * 0.62), r.h * 0.5)}
                  textAnchor="middle" fill="#b6c0cd"
                >
                  {r.name}
                </text>
              )}
            </g>
          ))}

          {activeRooms.map((r) => {
            const selected = r.id === selectedId
            const isStairs = r.kind === 'stairs'
            const L = labelLayout(r)
            return (
              <g key={r.id}>
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={r.color}
                  fillOpacity={isStairs ? 0.95 : 0.9}
                  stroke={selected ? '#2563eb' : '#64748b'}
                  strokeWidth={(selected ? 2 : 1) / scale}
                  strokeDasharray={r.locked && !selected ? `${0.4} ${0.3}` : undefined}
                  onPointerDown={(e) => startMove(e, r)}
                  style={{ cursor: r.locked ? 'pointer' : 'move' }}
                />

                {isStairs && <g style={{ pointerEvents: 'none' }}>{stairSteps(r)}</g>}

                <text
                  x={L.cx} y={L.nameY} fontSize={L.fName} textAnchor="middle" fill="#0f172a"
                  textLength={L.nameLen} lengthAdjust={L.nameLen ? 'spacingAndGlyphs' : undefined}
                  style={{ pointerEvents: 'none', fontWeight: 600 }}
                >
                  {L.name}
                </text>
                <text
                  x={L.cx} y={L.dimY} fontSize={L.fDim} textAnchor="middle" fill="#475569"
                  textLength={L.dimLen} lengthAdjust={L.dimLen ? 'spacingAndGlyphs' : undefined}
                  style={{ pointerEvents: 'none' }}
                >
                  {L.dim}
                </text>

                {/* จุดจับปรับขนาด — ซ่อนถ้าล็อก */}
                {selected && !r.locked &&
                  HANDLES.map(({ dir, cursor }) => {
                    const { cx, cy } = handlePos(r, dir)
                    return (
                      <rect
                        key={dir}
                        x={cx - handleSize / 2}
                        y={cy - handleSize / 2}
                        width={handleSize}
                        height={handleSize}
                        fill="#ffffff"
                        stroke="#2563eb"
                        strokeWidth={1.5 / scale}
                        onPointerDown={(e) => startResize(e, r, dir)}
                        style={{ cursor }}
                      />
                    )
                  })}
              </g>
            )
          })}

          {/* เส้นขอบโรงงาน */}
          <rect
            x={0}
            y={0}
            width={factoryW}
            height={factoryH}
            fill="none"
            stroke="#1e293b"
            strokeWidth={2.5 / scale}
            pointerEvents="none"
          />
        </svg>
      </div>
    </div>
  )
}
