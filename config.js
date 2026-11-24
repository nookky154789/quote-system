// ใส่ค่าจาก Supabase: Project Settings > API
//   url     = Project URL        (เช่น https://abcdxyz.supabase.co)
//   anonKey = anon / public key   (ขึ้นต้นด้วย eyJ... หรือ sb_publishable_...)
// คีย์ชนิดนี้ออกแบบให้เปิดเผยในหน้าเว็บได้ ความปลอดภัยอยู่ที่ Row Level Security ใน schema.sql
// ห้ามใส่ service_role key ในไฟล์นี้เด็ดขาด
window.QS_CONFIG = {
  url: 'https://rdycjuuzehjcyrpbrgch.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJkeWNqdXV6ZWhqY3lycGJyZ2NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTU0OTc5NTksImV4cCI6MjExMTA3Mzk1OX0.NEQ991R6TvyacF7xPH4QTOALMbthKAfBE9gaq2uwWzY'
};
