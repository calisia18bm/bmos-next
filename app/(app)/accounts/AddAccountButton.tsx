"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createAccount } from "./actions";

const ROLE_OPTIONS = [
  { key: "OWNER", label: "Owner" },
  { key: "ADMIN", label: "Admin" },
  { key: "TEACHER", label: "Laoshi (Teacher)" },
  { key: "STUDENT", label: "Murid (Student)" },
];

type Person = { id: string; name: string; teacher_code?: string; student_code?: string };

function personLabel(p: Person) {
  const code = p.teacher_code || p.student_code;
  return code ? `${p.name} (${code})` : p.name;
}

function findByName(list: Person[], name: string): Person | null {
  const target = name.trim().toLowerCase();
  if (!target) return null;
  const matches = list.filter((p) => p.name.trim().toLowerCase() === target);
  // Kalau namanya ketemu lebih dari satu (ada 2 orang namanya sama),
  // sengaja JANGAN auto-pilih -- biar Owner yang pilih manual pakai
  // kode-nya (L001, M0001, dst) di dropdown, biar ga salah orang.
  return matches.length === 1 ? matches[0] : null;
}

export default function AddAccountButton({
  teachers,
  students,
}: {
  teachers: Person[];
  students: Person[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<string[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [teacherAutoMatched, setTeacherAutoMatched] = useState(false);
  const [studentAutoMatched, setStudentAutoMatched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ email: string; password: string } | null>(
    null
  );

  // Begitu nama diketik & role Laoshi/Murid dicentang, coba cocokin
  // otomatis ke data yang namanya persis sama -- biar ga usah manual
  // pilih dari dropdown tiap kali. Yang beneran DISIMPAN itu id-nya
  // (bukan namanya), jadi tetep akurat & ga ketuker meskipun ada nama
  // yang mirip -- kalau ada duplikat nama, sistem malah sengaja ga
  // auto-pilih dan minta pilih manual pakai kode uniknya.
  useEffect(() => {
    if (roles.includes("TEACHER")) {
      const match = findByName(teachers, name);
      if (match) {
        setTeacherId(match.id);
        setTeacherAutoMatched(true);
      } else if (teacherAutoMatched) {
        setTeacherId("");
        setTeacherAutoMatched(false);
      }
    }
  }, [name, roles, teachers, teacherAutoMatched]);

  useEffect(() => {
    if (roles.includes("STUDENT")) {
      const match = findByName(students, name);
      if (match) {
        setStudentId(match.id);
        setStudentAutoMatched(true);
      } else if (studentAutoMatched) {
        setStudentId("");
        setStudentAutoMatched(false);
      }
    }
  }, [name, roles, students, studentAutoMatched]);

  function toggleRole(key: string) {
    setRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  }

  function reset() {
    setName("");
    setEmail("");
    setPassword("");
    setRoles([]);
    setTeacherId("");
    setStudentId("");
    setTeacherAutoMatched(false);
    setStudentAutoMatched(false);
    setError("");
    setResult(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await createAccount({
      name,
      email,
      roles,
      password,
      teacherId: teacherId || null,
      studentId: studentId || null,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    setResult({ email: res.email!, password: res.password! });
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-bmos-primary text-white rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition"
      >
        + Buat Akun
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {result ? (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-1">
                  Akun berhasil dibuat
                </h2>
                <p className="text-sm text-bmos-text-light mb-4">
                  Kirim info login ini ke orangnya (lewat WhatsApp misalnya).
                  Password ini cuma muncul sekali di sini, catat sekarang
                  sebelum ditutup.
                </p>
                <div className="bg-bmos-primary-soft/40 rounded-xl p-4 space-y-2 mb-4">
                  <p className="text-sm">
                    <span className="text-bmos-text-light">Email: </span>
                    <span className="font-semibold text-bmos-text">
                      {result.email}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-bmos-text-light">Password: </span>
                    <span className="font-semibold text-bmos-text font-mono">
                      {result.password}
                    </span>
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      reset();
                    }}
                    className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition"
                  >
                    Selesai
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-4">
                  Buat Akun Baru
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Nama Lengkap
                    </label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                    <p className="text-xs text-bmos-text-light mt-1">
                      Kalau namanya persis sama dengan yang udah ada di data
                      Laoshi/Murid, otomatis kehubung ke id-nya -- ga perlu
                      pilih manual. Kalau ada nama kembar, pilih manual pakai
                      kode di dropdown biar ga ketuker orangnya.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Email
                    </label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Password{" "}
                      <span className="text-bmos-text-light font-normal">
                        (opsional -- kosongin aja kalau mau di-generate otomatis)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 6 karakter"
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-2">
                      Role (boleh pilih lebih dari satu)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {ROLE_OPTIONS.map((r) => (
                        <label
                          key={r.key}
                          className={`flex items-center gap-2 border rounded-xl px-3 py-2 text-sm cursor-pointer transition ${
                            roles.includes(r.key)
                              ? "border-bmos-primary bg-bmos-primary-soft"
                              : "border-bmos-border hover:border-bmos-primary-light"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={roles.includes(r.key)}
                            onChange={() => toggleRole(r.key)}
                            className="accent-bmos-primary"
                          />
                          {r.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {roles.includes("TEACHER") && (
                    <div>
                      <label className="block text-sm font-medium text-bmos-text mb-1">
                        Hubungkan ke data Laoshi
                      </label>
                      {teacherAutoMatched && (
                        <p className="text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1 mb-1.5">
                          ✓ Otomatis kehubung berdasarkan nama.
                        </p>
                      )}
                      <select
                        value={teacherId}
                        onChange={(e) => {
                          setTeacherId(e.target.value);
                          setTeacherAutoMatched(false);
                        }}
                        className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                      >
                        <option value="">-- Pilih Laoshi (manual) --</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {personLabel(t)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {roles.includes("STUDENT") && (
                    <div>
                      <label className="block text-sm font-medium text-bmos-text mb-1">
                        Hubungkan ke data Murid
                      </label>
                      {studentAutoMatched && (
                        <p className="text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1 mb-1.5">
                          ✓ Otomatis kehubung berdasarkan nama.
                        </p>
                      )}
                      <select
                        value={studentId}
                        onChange={(e) => {
                          setStudentId(e.target.value);
                          setStudentAutoMatched(false);
                        }}
                        className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                      >
                        <option value="">-- Pilih Murid (manual) --</option>
                        {students.map((s) => (
                          <option key={s.id} value={s.id}>
                            {personLabel(s)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        reset();
                      }}
                      className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                    >
                      {loading ? "Membuat..." : "Buat Akun"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
