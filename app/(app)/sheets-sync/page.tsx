import { getCurrentProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isSheetsConfigured } from "@/lib/googleSheets";
import SyncButton from "./SyncButton";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function SheetsSyncPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.roles.includes("OWNER")) redirect("/");

  const configured = isSheetsConfigured();
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">System</p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">Google Sheets</h1>
      <p className="text-bmos-text-light text-sm mb-6">
        Data BMOS (murid, Laoshi, kelas, keuangan, akun, leads, absensi, tanya-jawab AI) disalin ke
        Google Sheets otomatis tiap hari. Tekan tombol di bawah kalau mau data terbaru sekarang.
      </p>

      <div className="bg-white border border-bmos-border rounded-2xl p-5 mb-6">
        <p className="text-sm font-semibold text-bmos-text mb-1">Status sambungan</p>
        {configured ? (
          <p className="text-sm text-green-700">
            Tersambung.{" "}
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              Buka spreadsheet
            </a>
          </p>
        ) : (
          <p className="text-sm text-yellow-800">
            Belum tersambung. Isi tiga pengaturan di Vercel (Settings, Environment Variables):
            GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, dan GOOGLE_SHEETS_ID, lalu deploy ulang.
          </p>
        )}
      </div>

      <SyncButton disabled={!configured} />
    </div>
  );
}
