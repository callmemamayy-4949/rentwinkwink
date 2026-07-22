# Winkwink Image Uploader

เว็บหน้าเดียวสำหรับเลือกรูปจากเครื่อง อัปโหลดเข้า `public/images/uploads/` ของ GitHub และรับลิงก์ `raw.githubusercontent.com` พร้อมคัดลอก

## ตั้งค่าบน Netlify

1. เชื่อม Site กับ repository `callmemamayy-4949/rentwinkwink`
2. ไม่ต้องใส่ Build command และตั้ง Publish directory เป็น `.`
3. เพิ่ม Environment variables:
   - `GITHUB_TOKEN` — Fine-grained token ที่เข้าถึง repository นี้และมีสิทธิ์ **Contents: Read and write**
   - `UPLOAD_PASSWORD` — รหัสสำหรับเจ้าของเว็บและเพื่อนที่ได้รับอนุญาต
   - `GITHUB_OWNER=callmemamayy-4949`
   - `GITHUB_REPO=rentwinkwink`
   - `GITHUB_BRANCH=main`
4. Deploy ใหม่หลังตั้งค่าตัวแปร

ห้ามใส่ `GITHUB_TOKEN` ในโค้ดหน้าเว็บหรือ commit ไฟล์ `.env`

## การทำงาน

- รองรับ JPG, PNG และ WebP ขนาดไม่เกิน 4 MB
- ทำชื่อไฟล์ให้ปลอดภัยโดยอัตโนมัติ
- ถ้าชื่อซ้ำ ระบบจะเติมตัวเลขท้ายชื่อแทนการทับไฟล์เดิม
- หลังอัปโหลดจะแสดง Raw URL พร้อมปุ่มคัดลอกและปุ่มแนบรูปต่อ
