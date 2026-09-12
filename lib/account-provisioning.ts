import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Dipakai bareng-bareng sama accounts/actions.ts, students/actions.ts, dan
// teachers/actions.ts -- biar password random yang di-generate selalu sama
// gayanya di mana pun dibuat.
export function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 10; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

// Bikin akun login (Supabase Auth + user_profiles) buat orang yang BARU
// AJA ditambahin ke Master Data (murid/laoshi) -- dipanggil dari
// students/actions.ts & teachers/actions.ts kalau Owner centang "buatkan
// akun login sekaligus" pas nambah murid/laoshi baru.
//
// Sengaja dibatasin cuma Owner yang boleh (sama kayak halaman Accounts) --
// kalau yang manggil bukan Owner (misal Admin lagi nambah murid), akunnya
// GA dibuat tapi data murid/laoshi-nya tetap kesimpen seperti biasa. Owner
// bisa buatin akunnya belakangan lewat halaman Accounts.
export async function provisionLinkedAccount(input: {
  name: string;
  email: string;
  password?: string;
  roles: string[];
  teacherId?: string | null;
  studentId?: string | null;
}): Promise<
  | { created: true; email: string; password: string }
  | { created: false; reason: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { created: false, reason: "Belum login." };

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const myRoles = myProfile?.roles || [];
  if (!myRoles.includes("OWNER")) {
    return {
      created: false,
      reason:
        "Cuma Owner yang bisa langsung buat akun login. Datanya tetap tersimpan -- akunnya bisa dibuatin nanti lewat halaman Accounts.",
    };
  }

  const email = input.email.trim().toLowerCase();
  if (!email) return { created: false, reason: "Email kosong." };

  const customPassword = (input.password || "").trim();
  if (customPassword && customPassword.length < 6) {
    return { created: false, reason: "Password minimal 6 karakter." };
  }
  const password = customPassword || generatePassword();

  const admin = createAdminClient();

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: input.name },
  });

  if (createErr || !created?.user) {
    return {
      created: false,
      reason: createErr?.message || "Gagal membuat akun login.",
    };
  }

  const { error: profileErr } = await admin.from("user_profiles").insert({
    id: created.user.id,
    email,
    full_name: input.name,
    roles: input.roles,
    active_role: input.roles[0],
    teacher_id: input.roles.includes("TEACHER") ? input.teacherId || null : null,
    student_id: input.roles.includes("STUDENT") ? input.studentId || null : null,
  });

  if (profileErr) {
    // Rollback -- jangan sampai ada akun auth "nyantol" tanpa profil.
    await admin.auth.admin.deleteUser(created.user.id);
    return { created: false, reason: profileErr.message };
  }

  return { created: true, email, password };
}
