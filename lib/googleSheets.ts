import { createSign } from "node:crypto";

// Client Google Sheets ringan (tanpa library googleapis) -- login pakai
// Service Account. Env yang dibutuhkan (set di Vercel):
//   GOOGLE_SERVICE_ACCOUNT_EMAIL  -> client_email dari file JSON service account
//   GOOGLE_PRIVATE_KEY            -> private_key dari file JSON yang sama
//   GOOGLE_SHEETS_ID              -> ID spreadsheet (bagian di URL antara /d/ dan /edit)

export function isSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY &&
      process.env.GOOGLE_SHEETS_ID
  );
}

function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  // Di env Vercel, baris baru di private key sering tersimpan sebagai "\n"
  // literal -- dikembalikan di sini.
  const key = process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  const signature = base64url(signer.sign(key));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${signature}`,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(
      `Login Google gagal: ${json.error_description || json.error || res.status}`
    );
  }
  return json.access_token as string;
}

export type SheetCell = string | number | boolean | null;
export type SheetTab = { name: string; rows: SheetCell[][] };

const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

async function sheetsFetch(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error?.message || `Google Sheets error ${res.status}`);
  }
  return json;
}

// Tulis ulang semua tab: tab yang belum ada dibuat, isinya dikosongkan lalu
// diisi data terbaru (baris pertama = judul kolom, dibekukan).
export async function writeTabs(tabs: SheetTab[]) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
  const token = await getAccessToken();

  const meta = await sheetsFetch(
    token,
    `${BASE}/${spreadsheetId}?fields=sheets.properties(sheetId,title)`
  );
  const existing = new Map<string, number>(
    (meta.sheets ?? []).map((s: { properties: { title: string; sheetId: number } }) => [
      s.properties.title,
      s.properties.sheetId,
    ])
  );

  const toAdd = tabs.filter((t) => !existing.has(t.name));
  if (toAdd.length) {
    const added = await sheetsFetch(token, `${BASE}/${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: toAdd.map((t) => ({ addSheet: { properties: { title: t.name } } })),
      }),
    });
    (added.replies ?? []).forEach(
      (r: { addSheet: { properties: { title: string; sheetId: number } } }) =>
        existing.set(r.addSheet.properties.title, r.addSheet.properties.sheetId)
    );
  }

  // Ukuran grid disesuaikan dengan isi + header dibekukan.
  await sheetsFetch(token, `${BASE}/${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: tabs.map((t) => ({
        updateSheetProperties: {
          properties: {
            sheetId: existing.get(t.name),
            gridProperties: {
              rowCount: Math.max(t.rows.length + 20, 50),
              columnCount: Math.max(t.rows[0]?.length ?? 1, 2),
              frozenRowCount: 1,
            },
          },
          fields: "gridProperties(rowCount,columnCount,frozenRowCount)",
        },
      })),
    }),
  });

  await sheetsFetch(token, `${BASE}/${spreadsheetId}/values:batchClear`, {
    method: "POST",
    body: JSON.stringify({ ranges: tabs.map((t) => `'${t.name}'`) }),
  });

  const CHUNK = 2000;
  for (const t of tabs) {
    for (let start = 0; start < t.rows.length; start += CHUNK) {
      const slice = t.rows.slice(start, start + CHUNK);
      await sheetsFetch(
        token,
        `${BASE}/${spreadsheetId}/values/${encodeURIComponent(
          `'${t.name}'!A${start + 1}`
        )}?valueInputOption=RAW`,
        { method: "PUT", body: JSON.stringify({ values: slice }) }
      );
    }
  }
}
