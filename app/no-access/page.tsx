export default function NoAccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-bmos-primary-soft flex items-center justify-center mx-auto mb-4 text-2xl">
          🔒
        </div>
        <h1 className="text-xl font-bold text-bmos-text mb-2">
          Akun belum diaktifkan
        </h1>
        <p className="text-sm text-bmos-text-light">
          Akun kamu berhasil login, tapi belum di-assign role (Owner /
          Teacher / Student) oleh admin. Hubungi admin BM Masterclass untuk
          mengaktifkan akses kamu.
        </p>
      </div>
    </div>
  );
}
