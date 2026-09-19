import Anthropic from "@anthropic-ai/sdk";

// Rekening tujuan transfer -- dipakai di semua fitur yang minta bukti
// transfer (Join Kelas Murid, Beli Bahan Ajar Laoshi, dll). Kalau
// rekeningnya ganti, tinggal edit nilai di sini aja, otomatis kepakai
// di semua fitur.
export const BANK_ACCOUNT = {
  bank: "BCA",
  holder: "Calisia",
  number: "7611673799",
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

// Baca gambar bukti transfer pake Claude (vision) -- CUMA bantu Admin
// baca nominal/tanggal/pengirim, BUKAN yang mutusin approve/reject.
// Kalau ANTHROPIC_API_KEY belum diset atau ada error apapun, tetep balikin
// pesan yang jelas (bukan lempar exception) biar request-nya TETAP
// kesimpen -- Admin masih bisa review manual dari foto bukti bayarnya
// langsung meski AI-nya gagal baca. Dipakai bareng oleh fitur Join Kelas
// (app/(app)/class-cards/actions.ts) & Beli Bahan Ajar
// (app/(app)/materials/actions.ts).
export async function readPaymentProofWithAI(
  imageUrl: string,
  itemInfo: { name: string; price: number | null }
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "AI belum bisa baca otomatis (ANTHROPIC_API_KEY belum diset di Vercel) -- tolong dicek manual dari fotonya.";
  }

  try {
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return "AI gagal ambil gambar bukti bayar -- tolong dicek manual dari fotonya.";
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const rawType = imgRes.headers.get("content-type") || "image/jpeg";
    const mediaType: AllowedImageType = (
      ALLOWED_IMAGE_TYPES as readonly string[]
    ).includes(rawType)
      ? (rawType as AllowedImageType)
      : "image/jpeg";

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system:
        'Kamu bantu Admin sekolah les Mandarin BACA bukti transfer/pembayaran. Sebutkan singkat: nominal yang keliatan di gambar, tanggal transaksi kalau ada, dan pengirim/metode kalau keliatan. Kalau gambarnya BUKAN bukti transfer sama sekali, bilang itu jelas. Kalau nominalnya enggak sesuai sama harga item, sebutkan selisihnya secara alami dalam kalimat itu juga. PENTING: kamu CUMA bantu baca, jangan pernah bilang "disetujui"/"approved"/"ditolak" -- keputusan approve/reject request ini 100% di tangan Admin manusia. WAJIB: jawab dalam 2-3 kalimat mengalir Bahasa Indonesia BIASA SAJA, TANPA markdown, TANPA bullet point/list, TANPA tanda bintang (*), TANPA heading/judul seperti "Hasil Baca:" atau "Catatan:" -- pesan ini bakal dikirim langsung lewat WhatsApp jadi harus berupa teks polos yang enak dibaca, bukan format dokumen.',
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `Item: ${itemInfo.name}, harga: ${
                itemInfo.price ? `Rp ${itemInfo.price.toLocaleString("id-ID")}` : "-"
              }. Tolong baca bukti pembayaran ini buat bantu Admin.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText =
      textBlock && "text" in textBlock
        ? textBlock.text
        : "AI enggak bisa baca gambar ini -- tolong dicek manual.";

    // Jaga-jaga kalau model TETAP ngasih markdown walau udah dilarang di
    // system prompt (kadang masih kejadian) -- bersihin tanda bintang &
    // bullet/heading-style sebelum dipakai, soalnya teks ini dikirim
    // mentah-mentah lewat WhatsApp (Fonnte ga render markdown), jadi
    // tanda bintangnya bakal keliatan literal kalau ga dibersihin dulu.
    return rawText
      .replace(/\*\*/g, "")
      .replace(/^#+\s*/gm, "")
      .replace(/^[-•*]\s+/gm, "")
      .replace(/\*/g, "")
      .trim();
  } catch (error) {
    return `AI gagal baca bukti bayar (${
      error instanceof Error ? error.message : "error"
    }) -- tolong dicek manual dari fotonya.`;
  }
}
