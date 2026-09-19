"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { provisionLinkedAccount } from "@/lib/account-provisioning";

// Cuma Owner/Admin yang boleh kelola data murid (nama, kontak, kelas,
// status, dsb) -- Murid/Laoshi liat data ini lewat halaman portal mereka
// sendiri (my-class, my-students), bukan dari sini.
async function requireStaff(): Promise<string | null> {
  const profile = await getCurrentProfile();

  if (!profile) return "Belum login.";

  const myRoles = profile.roles;
  if (!myRoles.includes("OWNER") && !myRoles.includes("ADMIN")) {
    return "Kamu ga punya akses buat kelola data murid.";
  }
  return null;
}

// Sama kayak halaman Accounts -- pengelolaan akun LOGIN (buat/lihat status
// akun murid) cuma buat Owner, Admin ga boleh. Ini dicek terpisah dari
// requireStaff() di atas karena requireStaff ngizinin Admin kelola data
// murid biasa (nama/kelas/dll), tapi khusus akun login tetap Owner-only.
async function requireOwnerForAccount(): Promise<string | null> {
  const profile = await getCurrentProfile();

  if (!profile) return "Belum login.";

  if (!(profile.roles).includes("OWNER")) {
    return "Cuma Owner yang bisa kelola akun login.";
  }
  return null;
}

// Dipanggil dari EditStudentButton buat cek apakah murid ini udah punya
// akun login atau belum. `visible: false` artinya yang buka BUKAN Owner --
// jadi section akun login-nya disembunyiin sama sekali di form Edit
// (sama kayak Admin ga boleh masuk halaman Accounts).
export async function getLinkedAccount(
  studentId: string
): Promise<
  | { visible: true; account: { id: string; email: string } | null }
  | { visible: false }
> {
  const ownerError = await requireOwnerForAccount();
  if (ownerError) return { visible: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("id, email")
    .eq("student_id", studentId)
    .maybeSingle();

  return { visible: true, account: data ? { id: data.id, email: data.email } : null };
}

// Bikin akun login buat murid yang SUDAH ada di Master Data -- dipanggil
// dari modal Edit Data Murid kalau muridnya belum punya akun sama sekali.
export async function createAccountForStudent(
  studentId: string,
  input: { name: string; email: string; password?: string }
) {
  const ownerError = await requireOwnerForAccount();
  if (ownerError) return { success: false, message: ownerError };

  const result = await provisionLinkedAccount({
    name: input.name,
    email: input.email,
    password: input.password,
    roles: ["STUDENT"],
    studentId,
  });

  if (!result.created) return { success: false, message: result.reason };

  revalidatePath("/accounts");
  return {
    success: true,
    message: "Akun berhasil dibuat.",
    email: result.email,
    password: result.password,
  };
}

// Dipanggil dari AddStudentButton buat ngisi dropdown pilihan kode murid.
// Isinya: semua nomor M0001..dst yang BELUM dipakai -- baik "lubang" dari
// kode lama (misal M0002 kosong karena murid itu dulu pernah dihapus) maupun
// nomor baru sesudah kode terbesar yang ada sekarang. Jadi Owner/Admin bisa
// milih sendiri mau pakai kode yang mana, bukan cuma nomor lanjutan otomatis.
export async function getAvailableStudentCodes(): Promise<string[]> {
  const authError = await requireStaff();
  if (authError) return [];

  const supabase = await createClient();
  const { data: allCodes } = await supabase
    .from("students")
    .select("student_code");

  const used = new Set<string>();
  let maxNumber = 0;
  (allCodes ?? []).forEach((row) => {
    if (row.student_code) used.add(row.student_code);
    const match = row.student_code?.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10);
      if (n > maxNumber) maxNumber = n;
    }
  });

  // +1 di ujung biar selalu ada minimal satu kode baru di paling bawah
  // daftar, meskipun kebetulan ga ada lubang sama sekali.
  const codes: string[] = [];
  for (let n = 1; n <= maxNumber + 1; n++) {
    const code = `M${String(n).padStart(4, "0")}`;
    if (!used.has(code)) codes.push(code);
  }
  return codes;
}

export async function addStudent(formData: {
  name: string;
  phone: string;
  classId?: string;
  status?: string;
  code?: string;
  // Opsional: kalau Owner mau sekalian bikinin akun login pas nambah
  // murid baru (bukan lewat halaman Accounts terpisah).
  createAccount?: boolean;
  email?: string;
  password?: string;
}) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  // Kelas opsional -- boleh ga dipilih dulu (murid baru daftar tapi belum
  // ditempatin ke kelas mana pun). Status juga opsional, default ACTIVE,
  // tapi boleh langsung diisi INACTIVE kalau muridnya belum aktif beneran
  // (misal masih proses daftar / belum bayar).
  let className: string | null = null;
  let teacherName: string | null = null;
  if (formData.classId) {
    const { data: cls } = await supabase
      .from("classes")
      .select("name, teacher_name")
      .eq("id", formData.classId)
      .maybeSingle();
    className = cls?.name || null;
    teacherName = cls?.teacher_name || null;
  }
  const status =
    formData.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";

  // Kode murid sekarang dipilih sendiri dari dropdown (lihat
  // getAvailableStudentCodes di atas). Kalau karena suatu hal formnya ga
  // ngirim kode (misal gagal fetch pilihannya), fallback ke cara lama --
  // ambil nomor TERBESAR dari SEMUA kode yang ada, baru +1, dengan retry
  // otomatis kalau kebetulan masih bentrok.
  let candidateCodes: string[];
  if (formData.code) {
    candidateCodes = [formData.code];
  } else {
    const { data: allCodes } = await supabase
      .from("students")
      .select("student_code");
    let maxNumber = 0;
    (allCodes ?? []).forEach((row) => {
      const match = row.student_code?.match(/\d+/);
      if (match) {
        const n = parseInt(match[0], 10);
        if (n > maxNumber) maxNumber = n;
      }
    });
    candidateCodes = [];
    for (let i = 0; i < 5; i++) {
      candidateCodes.push(`M${String(maxNumber + 1 + i).padStart(4, "0")}`);
    }
  }

  for (const studentCode of candidateCodes) {
    const { data: inserted, error } = await supabase
      .from("students")
      .insert({
        student_code: studentCode,
        name: formData.name,
        phone: formData.phone,
        class_id: formData.classId || null,
        class_name: className,
        teacher_name: teacherName,
        status,
      })
      .select("id")
      .single();

    if (!error && inserted) {
      revalidatePath("/students");

      // Kalau Owner centang "buatkan akun login sekaligus" dan isi email
      // -- langsung bikinin akunnya juga, kesambung ke murid yang baru
      // dibuat ini. Kalau gagal (misal bukan Owner yang nambah, atau
      // emailnya udah dipakai), data muridnya TETAP kesimpen -- cuma
      // akunnya yang ga jadi, dikasih tau lewat accountWarning.
      let account: { email: string; password: string } | undefined;
      let accountWarning: string | undefined;

      if (formData.createAccount && formData.email) {
        const result = await provisionLinkedAccount({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          roles: ["STUDENT"],
          studentId: inserted.id,
        });

        if (result.created) {
          account = { email: result.email, password: result.password };
          revalidatePath("/accounts");
        } else {
          accountWarning = result.reason;
        }
      }

      return {
        success: true,
        message: "Murid berhasil ditambahkan.",
        account,
        accountWarning,
      };
    }

    const isDuplicateCode =
      error?.message.includes("students_student_code_key");
    if (!isDuplicateCode) {
      return { success: false, message: error?.message || "Gagal menambahkan murid." };
    }
    // Kode yang dipilih di dropdown ternyata udah kepake duluan (misal
    // admin lain baru aja pakai kode yang sama) -- kasih tau biar user
    // pilih ulang, bukan diem-diem ganti kode sendiri.
    if (formData.code) {
      return {
        success: false,
        message: `Kode ${studentCode} baru aja kepake murid lain, coba pilih kode lain.`,
      };
    }
  }

  return {
    success: false,
    message: "Gagal generate kode murid unik, coba lagi.",
  };
}

// Cek apakah nama/no. HP yang diinput cocok dengan murid yang PERNAH
// terdaftar (status INACTIVE) -- biasanya karena murid ini dulu berhenti
// dan sekarang mau daftar lagi. Dipakai AddStudentButton buat nawarin
// "aktifkan lagi data lama" biar riwayat absensi & pembayaran lama nggak
// putus / kebentuk baris murid baru yang terpisah.
export async function findRejoinCandidates(name: string, phone: string) {
  const authError = await requireStaff();
  if (authError) return [];

  const supabase = await createClient();
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();

  if (!trimmedName && !trimmedPhone) return [];

  const orParts: string[] = [];
  if (trimmedPhone) orParts.push(`phone.eq.${trimmedPhone}`);
  if (trimmedName) orParts.push(`name.ilike.${trimmedName}`);

  const { data, error } = await supabase
    .from("students")
    .select("id, student_code, name, phone, class_name, teacher_name, status, created_at")
    .eq("status", "INACTIVE")
    .or(orParts.join(","))
    .limit(5);

  if (error) return [];
  return data ?? [];
}

// Aktifkan lagi murid lama (bukan bikin baris baru) -- supaya semua
// riwayat lama (absensi, pembayaran, enrollment) tetap nempel ke
// student_id yang sama persis.
export async function reactivateStudent(
  id: string,
  formData: { name: string; phone: string }
) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .update({
      name: formData.name,
      phone: formData.phone || null,
      status: "ACTIVE",
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return {
    success: true,
    message:
      "Murid berhasil diaktifkan kembali. Riwayat absensi & pembayaran lama tetap tersimpan. Silakan edit murid ini untuk atur kelas barunya.",
  };
}

export async function addAdditionalClass(
  studentId: string,
  classId: string
) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { data: cls } = await supabase
    .from("classes")
    .select("id, name")
    .eq("id", classId)
    .maybeSingle();

  if (!cls) return { success: false, message: "Kelas tidak ditemukan." };

  // Cek jangan sampai dobel -- murid udah aktif di kelas ini
  const { data: existing } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("class_id", classId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (existing) {
    return { success: false, message: `Murid sudah aktif di kelas ${cls.name}.` };
  }

  // Sama kayak student_code -- ambil nomor TERBESAR dari SEMUA kode
  // enrollment yang ada (bukan cuma yang terakhir dibuat), biar ga bentrok.
  const { data: allEnrollmentCodes } = await supabase
    .from("enrollments")
    .select("enrollment_code");

  let nextNumber = 1;
  (allEnrollmentCodes ?? []).forEach((row) => {
    const match = row.enrollment_code?.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10) + 1;
      if (n > nextNumber) nextNumber = n;
    }
  });
  const enrollmentCode = `ENR${String(nextNumber).padStart(5, "0")}`;

  const { error } = await supabase.from("enrollments").insert({
    enrollment_code: enrollmentCode,
    student_id: studentId,
    class_id: classId,
    status: "ACTIVE",
    started_at: new Date().toISOString().slice(0, 10),
  });

  if (error) return { success: false, message: error.message };

  revalidatePath(`/students/${studentId}`);
  return { success: true, message: `Berhasil ditambahkan ke kelas ${cls.name}.` };
}

export async function endEnrollment(enrollmentId: string, studentId: string) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("enrollments")
    .update({ status: "FINISHED", ended_at: new Date().toISOString().slice(0, 10) })
    .eq("id", enrollmentId);

  if (error) return { success: false, message: error.message };

  revalidatePath(`/students/${studentId}`);
  return { success: true, message: "Kelas berhasil dihentikan." };
}

export async function transferClass(
  studentId: string,
  fromEnrollmentId: string,
  newClassId: string,
  reason: string
) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { data: newClass } = await supabase
    .from("classes")
    .select("id, name, teacher_name")
    .eq("id", newClassId)
    .maybeSingle();

  if (!newClass) return { success: false, message: "Kelas tujuan tidak ditemukan." };

  const today = new Date().toISOString().slice(0, 10);

  // Tutup CUMA enrollment yang dipilih (bukan semua), biar aman kalau
  // murid lagi ikut lebih dari 1 kelas.
  const { error: closeError } = await supabase
    .from("enrollments")
    .update({ status: "FINISHED", ended_at: today })
    .eq("id", fromEnrollmentId);

  if (closeError) return { success: false, message: closeError.message };

  const { data: allEnrollmentCodes } = await supabase
    .from("enrollments")
    .select("enrollment_code");

  let nextNumber = 1;
  (allEnrollmentCodes ?? []).forEach((row) => {
    const match = row.enrollment_code?.match(/\d+/);
    if (match) {
      const n = parseInt(match[0], 10) + 1;
      if (n > nextNumber) nextNumber = n;
    }
  });
  const enrollmentCode = `ENR${String(nextNumber).padStart(5, "0")}`;

  const { error: enrollError } = await supabase.from("enrollments").insert({
    enrollment_code: enrollmentCode,
    student_id: studentId,
    class_id: newClassId,
    status: "ACTIVE",
    started_at: today,
  });

  if (enrollError) return { success: false, message: enrollError.message };

  // Cek: abis transfer ini, apa masih ada enrollment aktif lain? Kalau
  // nggak ada (ini kelas satu-satunya), update juga field class_id utama
  // di tabel students biar tampilan lama (list, dsb) tetep sinkron.
  const { data: stillActive } = await supabase
    .from("enrollments")
    .select("id")
    .eq("student_id", studentId)
    .eq("status", "ACTIVE");

  if ((stillActive ?? []).length <= 1) {
    await supabase
      .from("students")
      .update({
        class_id: newClassId,
        class_name: newClass.name,
        teacher_name: newClass.teacher_name,
        notes: reason ? `Pindah kelas: ${reason}` : undefined,
      })
      .eq("id", studentId);
  }

  revalidatePath(`/students/${studentId}`);
  revalidatePath("/students");
  return { success: true, message: `Berhasil pindah ke kelas ${newClass.name}.` };
}

export async function updateStudent(
  id: string,
  formData: {
    name: string;
    phone: string;
    classId: string;
    className: string;
    teacherName: string;
    sessionsPerPackage: string;
    packagePrice: string;
    status: string;
    notes: string;
  }
) {
  const authError = await requireStaff();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();

  const { error } = await supabase
    .from("students")
    .update({
      name: formData.name,
      phone: formData.phone || null,
      class_id: formData.classId || null,
      class_name: formData.className || null,
      teacher_name: formData.teacherName || null,
      sessions_per_package: Number(formData.sessionsPerPackage) || 4,
      package_price: Number(formData.packagePrice) || 0,
      status: formData.status,
      notes: formData.notes || null,
    })
    .eq("id", id);

  if (error) return { success: false, message: error.message };

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  return { success: true, message: "Data murid berhasil diperbarui." };
}
