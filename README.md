# ออกแบบผังโรงงาน — Floor Plan Designer

เว็บแอป Vite + React (TypeScript) ออกแบบผังโรงงานแบบ grid ลากย้าย/ปรับขนาดห้องได้ พร้อมกริดตามระยะเสาจริง, ระบบชั้น, ล็อกตำแหน่ง และบันทึกไฟล์

🌐 **เปิดใช้งาน:** https://sorotapb.github.io/floor-plan-designer/

## รันในเครื่อง

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # สร้าง production ใน dist/
```

## ความสามารถ

- **กริดตามเสาจริง** — เส้นเสาหลัก 5.5 × 5.2 ม. + เส้นย่อย ¼ ช่อง; ปรับระยะกริดได้
- **Snap ลงกริด** — เต็มช่อง / ½ / ¼ / ⅛; ทุกห้องลงกริดพอดี
- **ลากย้าย / ปรับขนาด** ด้วยจุดจับ 8 จุด
- **ระบบชั้น 1 / ชั้น 2** — สลับชั้น, ชั้นอื่นแสดงเป็นเงาอ้างอิง
- **ล็อกตำแหน่ง** — ห้อง/บันไดที่ต้องอยู่กับที่ (เช่น บันได/ลิฟต์)
- **บันทึกไฟล์** — Export/Import `.json`, Export รูป PNG; auto-save ลง browser
- **ซูมละเอียด** — ⌘/Ctrl + ล้อเมาส์ หรือ pinch, ปุ่มพอดีจอ
- **คำนวณพื้นที่** ตร.ม. ต่อห้อง + รวมต่อชั้น

## Deploy

push ขึ้น branch `main` แล้ว GitHub Actions (`.github/workflows/deploy.yml`) จะ build + deploy ขึ้น GitHub Pages อัตโนมัติ

## โครงสร้าง

- `src/types.ts` — ชนิดข้อมูล Room / Plan
- `src/seed.ts` — ผังเริ่มต้นจากแบบโรงงาน (วางเป็นช่องกริด)
- `src/geometry.ts` — helper พิกัด/ซูม
- `src/FloorPlanCanvas.tsx` — canvas SVG + ลาก/ปรับขนาด/กริด/ชั้น
- `src/App.tsx` — toolbar, sidebar, สถานะ, บันทึกไฟล์
