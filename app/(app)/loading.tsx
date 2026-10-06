// Layar sementara yang LANGSUNG tampil begitu menu/tombol navigasi diklik,
// selama halaman tujuan masih diambil datanya di server. Tanpa file ini
// layar terasa "diam" sampai semua data selesai. Sidebar tetap tampil
// karena layout.tsx tidak ikut diganti -- cuma area isi halaman yang
// diganti skeleton ini.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-live="polite">
      <div className="h-3 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-8 w-64 bg-gray-200 rounded-lg mb-3" />
      <div className="h-4 w-80 max-w-full bg-gray-100 rounded mb-8" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-white border border-bmos-border rounded-2xl" />
        ))}
      </div>
      <div className="bg-white border border-bmos-border rounded-2xl p-5 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
