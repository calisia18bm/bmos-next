// URL production website -- dipakai buat nyelipin link langsung ke
// halaman terkait di pesan WhatsApp (approve Class Card, dll), biar
// Owner/Laoshi/Murid tinggal tap linknya bukan harus buka app terus
// nyari-nyari menu sendiri.
//
// Override lewat env var NEXT_PUBLIC_SITE_URL kalau domainnya beda
// (misal lagi testing di domain preview Vercel).
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://app.bmmandarin.com";
