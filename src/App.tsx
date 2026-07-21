import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Plan, Room } from './types'
import { SEED_PLAN } from './seed'
import { clampScale, roomArea, bboxOf, partsOf } from './geometry'
import FloorPlanCanvas from './FloorPlanCanvas'
import './App.css'

// เลื่อนเลขเวอร์ชันเมื่อเปลี่ยน draft เริ่มต้น เพื่อให้ browser โหลดผังใหม่แทนของเก่าที่เซฟไว้
const STORAGE_KEY = 'floor-plan-designer:v5'

const PALETTE = [
  '#bfdbfe', '#fde68a', '#c7f9cc', '#fbcfe8',
  '#ddd6fe', '#fed7aa', '#a5f3fc', '#fecaca',
]

function loadPlan(): Plan {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const p = JSON.parse(raw) as Plan
      // เติมค่ากริดถ้าไฟล์เก่าไม่มี
      if (!p.gridX) p.gridX = SEED_PLAN.gridX
      if (!p.gridY) p.gridY = SEED_PLAN.gridY
      return p
    }
  } catch {
    /* ignore */
  }
  return structuredClone(SEED_PLAN)
}

let idCounter = Date.now()
function newId() {
  return 'r' + (idCounter++).toString(36)
}

export default function App() {
  const [plan, setPlan] = useState<Plan>(loadPlan)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null

  // เลือกห้อง: คลิกปกติ = เลือกเดี่ยว, Shift/⌘ คลิก = เลือกเพิ่ม/สลับ
  const selectRoom = useCallback((id: string | null, additive: boolean) => {
    if (id == null) { setSelectedIds([]); return }
    setSelectedIds((prev) =>
      additive
        ? prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        : [id],
    )
  }, [])
  const [scale, setScale] = useState(11) // พิกเซลต่อเมตร
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [subdiv, setSubdiv] = useState(4) // ช่องย่อยต่อ 1 ช่องกริด (วาดเส้น + snap)
  const [fitSignal, setFitSignal] = useState(0)
  const [activeFloor, setActiveFloor] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const snapX = snapEnabled ? plan.gridX / subdiv : 0
  const snapY = snapEnabled ? plan.gridY / subdiv : 0

  // บันทึกอัตโนมัติ
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
  }, [plan])

  const changeRoom = useCallback((id: string, patch: Partial<Room>) => {
    setPlan((p) => ({
      ...p,
      rooms: p.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    }))
  }, [])

  function addRoom() {
    const id = newId()
    const color = PALETTE[plan.rooms.length % PALETTE.length]
    setPlan((p) => ({
      ...p,
      rooms: [...p.rooms, { id, name: 'ห้องใหม่', x: 0, y: 0, w: plan.gridX * 2, h: plan.gridY * 2, color, floor: activeFloor }],
    }))
    setSelectedIds([id])
  }

  function addStairs() {
    const id = newId()
    setPlan((p) => ({
      ...p,
      rooms: [...p.rooms, { id, name: 'บันได', x: 0, y: 0, w: plan.gridX, h: plan.gridY, color: '#cbd5e1', kind: 'stairs', locked: false, floor: activeFloor }],
    }))
    setSelectedIds([id])
  }

  function addMachine() {
    const id = newId()
    setPlan((p) => ({
      ...p,
      rooms: [...p.rooms, { id, name: 'เครื่องจักร', x: 0, y: 0, w: plan.gridX, h: plan.gridY / 2, color: '#94a3b8', kind: 'machine', floor: activeFloor }],
    }))
    setSelectedIds([id])
  }

  function deleteRoom(id: string) {
    setPlan((p) => ({ ...p, rooms: p.rooms.filter((r) => r.id !== id) }))
    setSelectedIds((prev) => prev.filter((x) => x !== id))
  }

  function deleteSelected() {
    if (!selectedIds.length) return
    setPlan((p) => ({ ...p, rooms: p.rooms.filter((r) => !selectedIds.includes(r.id)) }))
    setSelectedIds([])
  }

  function duplicateRoom(id: string) {
    const src = plan.rooms.find((r) => r.id === id)
    if (!src) return
    const nid = newId()
    const parts = src.parts ? src.parts.map((p) => ({ ...p, x: p.x + 2, y: p.y + 2 })) : undefined
    setPlan((p) => ({
      ...p,
      rooms: [...p.rooms, { ...src, id: nid, name: src.name + ' (สำเนา)', x: src.x + 2, y: src.y + 2, parts }],
    }))
    setSelectedIds([nid])
  }

  // รวมห้องที่เลือก (≥2) เป็นชิ้นเดียว (รูปตัว L ฯลฯ)
  function mergeSelected() {
    const sel = plan.rooms.filter((r) => selectedIds.includes(r.id))
    if (sel.length < 2) return
    const primary = [...sel].sort((a, b) => roomArea(b) - roomArea(a))[0]
    const parts = sel.flatMap((r) => partsOf(r))
    const bb = bboxOf(parts)
    const merged: Room = { ...primary, parts, x: bb.x, y: bb.y, w: bb.w, h: bb.h }
    setPlan((p) => ({
      ...p,
      rooms: [...p.rooms.filter((r) => !selectedIds.includes(r.id)), merged],
    }))
    setSelectedIds([merged.id])
  }

  // แยกห้องประกอบกลับเป็นสี่เหลี่ยมแยกชิ้น
  function splitSelected() {
    const r = plan.rooms.find((x) => x.id === selectedId)
    if (!r || !r.parts || r.parts.length < 2) return
    const pieces: Room[] = r.parts.map((pt, i) => ({
      id: newId(), name: i === 0 ? r.name : `${r.name} ${i + 1}`, color: r.color,
      kind: r.kind, floor: r.floor, x: pt.x, y: pt.y, w: pt.w, h: pt.h,
    }))
    setPlan((p) => ({ ...p, rooms: [...p.rooms.filter((x) => x.id !== r.id), ...pieces] }))
    setSelectedIds(pieces.map((p) => p.id))
  }

  function resetPlan() {
    if (confirm('ล้างแบบทั้งหมดและกลับไปใช้ผังโรงงานเริ่มต้น?')) {
      setPlan(structuredClone(SEED_PLAN))
      setSelectedIds([])
    }
  }

  // ===== บันทึก / เปิดไฟล์ / ส่งออกรูป =====
  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  function exportJSON() {
    const data = JSON.stringify(plan, null, 2)
    downloadBlob(new Blob([data], { type: 'application/json' }), 'floor-plan.json')
  }

  function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset เพื่อเปิดไฟล์เดิมซ้ำได้
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const p = JSON.parse(String(reader.result)) as Plan
        if (!Array.isArray(p.rooms) || typeof p.factoryW !== 'number') throw new Error('รูปแบบไฟล์ไม่ถูกต้อง')
        if (!p.gridX) p.gridX = SEED_PLAN.gridX
        if (!p.gridY) p.gridY = SEED_PLAN.gridY
        setPlan(p)
        setSelectedIds([])
      } catch (err) {
        alert('เปิดไฟล์ไม่สำเร็จ: ' + (err as Error).message)
      }
    }
    reader.readAsText(file)
  }

  function exportPNG() {
    const svg = document.querySelector('.canvas-wrap svg') as SVGSVGElement | null
    if (!svg) return
    const vb = svg.viewBox.baseVal
    const EXPORT_SCALE = 24
    const clone = svg.cloneNode(true) as SVGSVGElement
    // ลบจุดจับปรับขนาด (ขอบสีน้ำเงิน) ออกจากรูป
    clone.querySelectorAll('rect[stroke="#2563eb"][fill="#ffffff"]').forEach((n) => n.remove())
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('x', String(vb.x)); bg.setAttribute('y', String(vb.y))
    bg.setAttribute('width', String(vb.width)); bg.setAttribute('height', String(vb.height))
    bg.setAttribute('fill', '#ffffff')
    clone.insertBefore(bg, clone.firstChild)
    clone.setAttribute('width', String(vb.width * EXPORT_SCALE))
    clone.setAttribute('height', String(vb.height * EXPORT_SCALE))
    const xml = new XMLSerializer().serializeToString(clone)
    const src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = vb.width * EXPORT_SCALE
      canvas.height = vb.height * EXPORT_SCALE
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `floor-plan-floor${activeFloor}.png`) }, 'image/png')
    }
    img.src = src
  }

  // ลบด้วยปุ่ม Delete/Backspace
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length) {
        e.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds])

  const floorRooms = useMemo(
    () => plan.rooms.filter((r) => (r.floor ?? 1) === activeFloor),
    [plan.rooms, activeFloor],
  )
  const totalRoomArea = useMemo(
    // ไม่รวมเครื่องจักร (ทับบนห้อง จะนับซ้ำ)
    () => floorRooms.filter((r) => r.kind !== 'machine').reduce((s, r) => s + roomArea(r), 0),
    [floorRooms],
  )
  const factoryArea = plan.factoryW * plan.factoryH
  const selected = plan.rooms.find((r) => r.id === selectedId) || null
  const canMerge = selectedIds.length >= 2

  return (
    <div className="app">
      <header className="topbar">
        <div className="title">
          <strong>ออกแบบผังโรงงาน</strong>
          <span className="sub">ลากเพื่อย้าย · ลากมุม/ขอบเพื่อปรับขนาด · ⌘/Ctrl + ล้อเมาส์ (หรือ pinch) เพื่อซูม · หน่วยเป็นเมตร</span>
        </div>
        <div className="tools">
          <div className="floors">
            {[1, 2].map((f) => (
              <button
                key={f}
                className={'btn floor' + (activeFloor === f ? ' active' : '')}
                onClick={() => { setActiveFloor(f); setSelectedIds([]) }}
              >
                ชั้น {f}
              </button>
            ))}
          </div>
          <button className="btn primary" onClick={addRoom}>+ เพิ่มห้อง</button>
          <button className="btn" onClick={addStairs}>+ บันได</button>
          <button className="btn" onClick={addMachine}>⚙ เครื่องจักร</button>
          <button className="btn" onClick={mergeSelected} disabled={!canMerge}
            title="เลือก 2 ห้องขึ้นไป (Shift-คลิก) แล้วรวมเป็นชิ้นเดียว">⧉ รวมห้อง</button>
          <div className="zoom">
            <button className="btn" title="ซูมออก" onClick={() => setScale((s) => clampScale(s / 1.25))}>−</button>
            <span>{Math.round(scale)} px/m</span>
            <button className="btn" title="ซูมเข้า" onClick={() => setScale((s) => clampScale(s * 1.25))}>+</button>
            <button className="btn" title="ให้ผังพอดีหน้าจอ" onClick={() => setFitSignal((n) => n + 1)}>พอดีจอ</button>
          </div>
          <label className="snap">
            <input
              type="checkbox"
              checked={snapEnabled}
              onChange={(e) => setSnapEnabled(e.target.checked)}
            />
            Snap กริด
            <select
              value={subdiv}
              disabled={!snapEnabled}
              onChange={(e) => setSubdiv(Number(e.target.value))}
            >
              <option value={1}>เต็มช่อง ({plan.gridX}×{plan.gridY})</option>
              <option value={2}>½ ช่อง</option>
              <option value={4}>¼ ช่อง ({(plan.gridX / 4).toFixed(3)}×{(plan.gridY / 4).toFixed(3)})</option>
              <option value={8}>⅛ ช่อง</option>
            </select>
          </label>
          <div className="filegroup">
            <button className="btn" title="บันทึกงานเป็นไฟล์ .json" onClick={exportJSON}>💾 บันทึกไฟล์</button>
            <button className="btn" title="เปิดไฟล์ .json ที่บันทึกไว้" onClick={() => fileInputRef.current?.click()}>📂 เปิดไฟล์</button>
            <button className="btn" title="ส่งออกเป็นรูป PNG" onClick={exportPNG}>🖼️ PNG</button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={importJSON}
            />
          </div>
          <button className="btn ghost" onClick={resetPlan}>รีเซ็ต</button>
        </div>
      </header>

      <div className="body">
        <main className="stage">
          <FloorPlanCanvas
            factoryW={plan.factoryW}
            factoryH={plan.factoryH}
            gridX={plan.gridX}
            gridY={plan.gridY}
            subdiv={subdiv}
            rooms={plan.rooms}
            activeFloor={activeFloor}
            selectedIds={selectedIds}
            scale={scale}
            snapX={snapX}
            snapY={snapY}
            fitSignal={fitSignal}
            onSelect={selectRoom}
            onChangeRoom={changeRoom}
            onScaleChange={(s) => setScale(clampScale(s))}
          />
        </main>

        <aside className="sidebar">
          <section className="panel">
            <h3>ขนาดโรงงาน</h3>
            <div className="row2">
              <label>
                กว้าง (ม.)
                <input
                  type="number" step="0.1" value={plan.factoryW}
                  onChange={(e) => setPlan((p) => ({ ...p, factoryW: Number(e.target.value) || 0 }))}
                />
              </label>
              <label>
                ยาว (ม.)
                <input
                  type="number" step="0.1" value={plan.factoryH}
                  onChange={(e) => setPlan((p) => ({ ...p, factoryH: Number(e.target.value) || 0 }))}
                />
              </label>
            </div>
            <div className="row2">
              <label>
                กริดเสา X (ม.)
                <input
                  type="number" step="0.1" value={plan.gridX}
                  onChange={(e) => setPlan((p) => ({ ...p, gridX: Number(e.target.value) || 1 }))}
                />
              </label>
              <label>
                กริดแถว Y (ม.)
                <input
                  type="number" step="0.1" value={plan.gridY}
                  onChange={(e) => setPlan((p) => ({ ...p, gridY: Number(e.target.value) || 1 }))}
                />
              </label>
            </div>
            <div className="stat">
              พื้นที่โรงงาน <b>{factoryArea.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b> ตร.ม.
            </div>
            <div className="stat">
              พื้นที่ห้อง (ชั้น {activeFloor}) <b>{totalRoomArea.toLocaleString(undefined, { maximumFractionDigits: 1 })}</b> ตร.ม.
              <span className="pct">({factoryArea ? ((totalRoomArea / factoryArea) * 100).toFixed(0) : 0}%)</span>
            </div>
          </section>

          <section className="panel">
            <h3>ห้องที่เลือก</h3>
            {selectedIds.length >= 2 ? (
              <div>
                <p className="hint">เลือก {selectedIds.length} ห้อง</p>
                <div className="editor-actions">
                  <button className="btn primary" onClick={mergeSelected}>⧉ รวมเป็นชิ้นเดียว</button>
                  <button className="btn danger" onClick={deleteSelected}>ลบทั้งหมด</button>
                </div>
              </div>
            ) : selected ? (
              <RoomEditor
                room={selected}
                onChange={(patch) => changeRoom(selected.id, patch)}
                onDuplicate={() => duplicateRoom(selected.id)}
                onDelete={() => deleteRoom(selected.id)}
                onSplit={selected.parts && selected.parts.length > 1 ? splitSelected : undefined}
              />
            ) : (
              <p className="hint">คลิกห้องบนผังเพื่อแก้ไข · Shift-คลิกเพื่อเลือกหลายห้อง (แล้วรวมได้)</p>
            )}
          </section>

          <section className="panel">
            <h3>ห้องในชั้น {activeFloor} ({floorRooms.length})</h3>
            <ul className="roomlist">
              {floorRooms.map((r) => (
                <li
                  key={r.id}
                  className={selectedIds.includes(r.id) ? 'active' : ''}
                  onClick={(e) => selectRoom(r.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                >
                  <span className="swatch" style={{ background: r.color }} />
                  <span className="rname">{r.kind === 'machine' ? '⚙ ' : ''}{r.parts && r.parts.length > 1 ? '⧉ ' : ''}{r.name}</span>
                  <span className="rarea">{roomArea(r).toFixed(1)} ตร.ม.</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}

function RoomEditor({
  room,
  onChange,
  onDuplicate,
  onDelete,
  onSplit,
}: {
  room: Room
  onChange: (patch: Partial<Room>) => void
  onDuplicate: () => void
  onDelete: () => void
  onSplit?: () => void
}) {
  const isComposite = !!(room.parts && room.parts.length > 1)
  const area = roomArea(room)
  return (
    <div className="editor">
      <label>
        ชื่อห้อง
        <input value={room.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>

      {isComposite ? (
        <div className="row2">
          <div className="area-big" style={{ flex: 2 }}>
            {area.toFixed(2)} <small>ตร.ม. (ห้องประกอบ)</small>
          </div>
          <label>
            สี
            <input type="color" value={room.color} onChange={(e) => onChange({ color: e.target.value })} />
          </label>
        </div>
      ) : (
        <>
          <div className="row2">
            <label>
              กว้าง w (ม.)
              <input
                type="number" step="0.1" value={room.w}
                onChange={(e) => onChange({ w: Math.max(0.5, Number(e.target.value) || 0) })}
              />
            </label>
            <label>
              ยาว h (ม.)
              <input
                type="number" step="0.1" value={room.h}
                onChange={(e) => onChange({ h: Math.max(0.5, Number(e.target.value) || 0) })}
              />
            </label>
          </div>
          <div className="row2">
            <label>
              ตำแหน่ง x (ม.)
              <input
                type="number" step="0.1" value={room.x}
                onChange={(e) => onChange({ x: Number(e.target.value) || 0 })}
              />
            </label>
            <label>
              ตำแหน่ง y (ม.)
              <input
                type="number" step="0.1" value={room.y}
                onChange={(e) => onChange({ y: Number(e.target.value) || 0 })}
              />
            </label>
          </div>
          <div className="row2">
            <label>
              สี
              <input type="color" value={room.color} onChange={(e) => onChange({ color: e.target.value })} />
            </label>
            <div className="area-big">
              {area.toFixed(2)} <small>ตร.ม.</small>
            </div>
          </div>
        </>
      )}

      <label className="lock-toggle">
        <input
          type="checkbox"
          checked={!!room.locked}
          onChange={(e) => onChange({ locked: e.target.checked })}
        />
        🔒 ล็อกตำแหน่ง (ลาก/ปรับขนาดไม่ได้)
      </label>
      {onSplit && (
        <div className="editor-actions">
          <button className="btn" onClick={onSplit}>⧉ แยกชิ้น</button>
        </div>
      )}
      <div className="editor-actions">
        <button className="btn" onClick={onDuplicate}>ทำสำเนา</button>
        <button className="btn danger" onClick={onDelete}>ลบห้อง</button>
      </div>
    </div>
  )
}
