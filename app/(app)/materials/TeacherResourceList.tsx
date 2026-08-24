// Server component sederhana (ga ada interaksi) -- Laoshi CUMA dikasih
// pdf_file_url lewat props (lihat app/(app)/materials/page.tsx, query-nya
// SENGAJA ga select kolom original_file_* sama sekali buat role Laoshi),
// jadi ga ada cara buat Laoshi dapetin file aslinya dari halaman ini.
type Resource = {
  id: string;
  title: string;
  description: string | null;
  pdf_file_url: string;
  pdf_file_name: string | null;
  created_at: string;
};

export default function TeacherResourceList({ resources }: { resources: Resource[] }) {
  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-6">
      <h2 className="font-bold text-bmos-text text-lg mb-1">
        Bahan Ajar dari Admin/Owner
      </h2>
      <p className="text-xs text-bmos-text-light mb-4">
        Cuma bisa dilihat/didownload dalam bentuk PDF -- dipakai sebagai
        bahan ngajar ke Murid.
      </p>

      {resources.length === 0 ? (
        <p className="text-sm text-bmos-text-light text-center py-8">
          Belum ada bahan ajar dari Admin/Owner.
        </p>
      ) : (
        <div className="space-y-3">
          {resources.map((r) => (
            <div key={r.id} className="border-b border-bmos-border last:border-0 pb-3 last:pb-0">
              <p className="text-sm font-semibold text-bmos-text">{r.title}</p>
              {r.description && (
                <p className="text-sm text-bmos-text-light mt-1">{r.description}</p>
              )}
              <a
                href={r.pdf_file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-bmos-primary hover:underline mt-1 inline-block"
              >
                📄 {r.pdf_file_name || "Buka PDF"}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
