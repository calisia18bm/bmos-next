import { createAdminClient } from "@/lib/supabase/admin";
import { isSheetsConfigured, writeTabs, SheetCell, SheetTab } from "@/lib/googleSheets";

type Row = Record<string, unknown>;

type Dataset = {
  tab: string;
  table: string;
  orderBy?: string;
  // filter sederhana: kolom yang TIDAK BOLEH null
  notNull?: string;
};

// Daftar tab di Google Sheets. Tambah baris di sini kalau nanti ada data baru.
const DATASETS: Dataset[] = [
  { tab: "Murid", table: "students" },
  { tab: "Enrollment", table: "enrollments" },
  { tab: "Laoshi", table: "teachers" },
  { tab: "Kelas", table: "classes" },
  { tab: "Class Card", table: "classes", notNull: "created_by_teacher_id" },
  { tab: "Pembayaran Murid", table: "payments" },
  { tab: "Pembayaran Bulanan", table: "monthly_payments" },
  { tab: "Pengeluaran", table: "expenses" },
  { tab: "Payroll", table: "payroll" },
  { tab: "Pembelian Bahan Ajar", table: "teacher_resource_purchases" },
  { tab: "Accounts", table: "user_profiles" },
  { tab: "Leads", table: "leads" },
  { tab: "Trials", table: "trials" },
  { tab: "Follow Up", table: "follow_ups" },
  { tab: "Absensi", table: "attendance" },
  { tab: "Sesi", table: "sessions" },
  { tab: "AI Tanya Jawab", table: "ai_conversations", orderBy: "created_at" },
];

// Kolom *_id yang ditambahi kolom nama supaya gampang dibaca di spreadsheet.
const NAME_LOOKUPS: Record<string, "students" | "teachers" | "classes" | "leads"> = {
  student_id: "students",
  teacher_id: "teachers",
  created_by_teacher_id: "teachers",
  class_id: "classes",
  lead_id: "leads",
};

// Supabase membatasi 1000 baris per permintaan, jadi diambil per halaman.
async function fetchAll(table: string, orderBy: string, notNull?: string): Promise<Row[]> {
  const supabase = createAdminClient();
  const rows: Row[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    let q = supabase.from(table).select("*").order(orderBy, { ascending: true }).range(from, from + PAGE - 1);
    if (notNull) q = q.not(notNull, "is", null);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function toCell(v: unknown): SheetCell {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  return String(v);
}

export type SyncResult = {
  ok: boolean;
  message: string;
  tabs: { tab: string; rows: number; error?: string }[];
};

export async function runSheetsSync(): Promise<SyncResult> {
  if (!isSheetsConfigured()) {
    return {
      ok: false,
      message:
        "Google Sheets belum disambungkan. Isi GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY, dan GOOGLE_SHEETS_ID di Vercel.",
      tabs: [],
    };
  }

  // 1. Ambil semua data (paralel). Tabel yang gagal dibaca (misal belum
  //    dibuat lewat SQL) dilewati dan dilaporkan, tidak menghentikan yang lain.
  const results = await Promise.all(
    DATASETS.map(async (d) => {
      try {
        return { d, rows: await fetchAll(d.table, d.orderBy ?? "id", d.notNull), error: undefined as string | undefined };
      } catch (e) {
        return { d, rows: [] as Row[], error: e instanceof Error ? e.message : "Gagal membaca" };
      }
    })
  );

  // 2. Peta id -> nama dari tabel utama
  const nameMaps: Record<string, Map<string, string>> = {
    students: new Map(),
    teachers: new Map(),
    classes: new Map(),
    leads: new Map(),
  };
  const source: Record<string, string> = { Murid: "students", Laoshi: "teachers", Kelas: "classes", Leads: "leads" };
  results.forEach(({ d, rows }) => {
    const key = source[d.tab];
    if (!key) return;
    rows.forEach((r) => nameMaps[key].set(String(r.id), String(r.name ?? "")));
  });

  // 3. Susun tab
  const tabs: SheetTab[] = [];
  const summary: SyncResult["tabs"] = [];

  for (const { d, rows, error } of results) {
    if (error) {
      summary.push({ tab: d.tab, rows: 0, error });
      continue;
    }
    // Header = gabungan semua kolom; kolom nama disisipkan setelah kolom *_id
    const keys: string[] = [];
    rows.forEach((r) => Object.keys(r).forEach((k) => !keys.includes(k) && keys.push(k)));
    const header: string[] = [];
    const lookups: { col: string; map: Map<string, string> }[] = [];
    keys.forEach((k) => {
      header.push(k);
      const lookup = NAME_LOOKUPS[k];
      if (lookup) {
        header.push(`${k.replace(/_id$/, "")}_nama`);
        lookups.push({ col: k, map: nameMaps[lookup] });
      }
    });

    const body: SheetCell[][] = rows.map((r) => {
      const line: SheetCell[] = [];
      keys.forEach((k) => {
        line.push(toCell(r[k]));
        const lk = lookups.find((l) => l.col === k);
        if (lk) line.push(r[k] ? lk.map.get(String(r[k])) ?? "" : "");
      });
      return line;
    });

    tabs.push({ name: d.tab, rows: [header.length ? header : ["(kosong)"], ...body] });
    summary.push({ tab: d.tab, rows: rows.length });
  }

  const now = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  tabs.push({
    name: "Info Sinkron",
    rows: [
      ["tab", "jumlah_baris", "status"],
      ...summary.map((s) => [s.tab, s.rows, s.error ? `GAGAL: ${s.error}` : "OK"] as SheetCell[]),
      ["", "", ""],
      ["terakhir_sinkron (WIB)", now, ""],
    ],
  });

  try {
    await writeTabs(tabs);
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Gagal menulis ke Google Sheets.",
      tabs: summary,
    };
  }

  const failed = summary.filter((s) => s.error).length;
  return {
    ok: true,
    message: failed
      ? `Tersinkron, tapi ${failed} tab dilewati (lihat detail).`
      : `Semua ${summary.length} tab berhasil disinkronkan.`,
    tabs: summary,
  };
}
