// Nama di bawah "Selamat Datang" -- sengaja dibuat READ-ONLY di sini.
// Sumber datanya sama persis dengan kolom "Nama Lengkap" di halaman
// Accounts, dan cuma bisa diubah dari sana (Accounts > Edit), bukan
// dengan klik langsung di Home.
export default function NameEditor({ fullName }: { fullName: string | null }) {
  return (
    <p className="text-lg font-semibold text-bmos-text-light">
      {fullName || "-"}
    </p>
  );
}
