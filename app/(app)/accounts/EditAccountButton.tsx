"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { resetAccountPassword, updateAccount } from "./actions";

const ROLE_OPTIONS = [
  { key: "OWNER", label: "Owner" },
  { key: "ADMIN", label: "Admin" },
  { key: "TEACHER", label: "Laoshi (Teacher)" },
  { key: "STUDENT", label: "Murid (Student)" },
];

type Person = { id: string; name: string; teacher_code?: string; student_code?: string };

export default function EditAccountButton({
  account,
  teachers,
  students,
}: {
  account: {
    id: string;
    email: string;
    full_name: string | null;
    roles: string[];
    teacher_id: string | null;
    student_id: string | null;
  };
  teachers: Person[];
  students: Person[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account.full_name || "");
  const [roles, setRoles] = useState<string[]>(account.roles || []);

  const currentTeacher = teachers.find((t) => t.id === account.teacher_id);
  const currentStudent = students.find((s) => s.id === account.student_id);
  const [teacherCode, setTeacherCode] = useState(currentTeacher?.teacher_code || "");
  const [studentCode, setStudentCode] = useState(currentStudent?.student_code || "");

  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [newPassword, setNewPassword] = useState<string | null>(null);

  const matchedTeacher = useMemo(() => {
    const code = teacherCode.trim().toUpperCase();
    if (!code) return null;
    return teachers.find((t) => (t.teacher_code || "").toUpperCase() === code) || null;
  }, [teacherCode, teachers]);

  const matchedStudent = useMemo(() => {
    const code = studentCode.trim().toUpperCase();
    if (!code) return null;
    return students.find((s) => (s.student_code || "").toUpperCase() === code) || null;
  }, [studentCode, students]);

  // Kalau kode diganti ke orang lain, ikut update Nama Lengkap-nya juga
  // biar ga ketuker (misal salah reassign ke Laoshi/Murid lain).
  useEffect(() => {
    if (matchedTeacher && matchedTeacher.id !== account.teacher_id) {
      setName(matchedTeacher.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedTeacher]);

  useEffect(() => {
    if (matchedStudent && matchedStudent.id !== account.student_id) {
      setName(matchedStudent.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedStudent]);

  function toggleRole(key: string) {
    setRoles((prev) =>
      prev.includes(key) ? prev.filter((r) => r !== key) : [...prev, key]
    );
  }

  function closeAndReset() {
    setOpen(false);
    setName(account.full_name || "");
    setRoles(account.roles || []);
    setTeacherCode(currentTeacher?.teacher_code || "");
    setStudentCode(currentStudent?.student_code || "");
    setError("");
    setNewPassword(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (roles.includes("TEACHER") && teacherCode.trim() && !matchedTeacher) {
      setError("Kode Laoshi tidak ditemukan. Cek lagi kodenya di halaman Teachers.");
      return;
    }
    if (roles.includes("STUDENT") && studentCode.trim() && !matchedStudent) {
      setError("Kode Murid tidak ditemukan. Cek lagi kodenya di halaman Students.");
      return;
    }

    setLoading(true);
    const res = await updateAccount(account.id, {
      name,
      roles,
      teacherId: matchedTeacher?.id || null,
      studentId: matchedStudent?.id || null,
    });
    setLoading(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    router.refresh();
    setOpen(false);
  }

  async function handleResetPassword() {
    setResetting(true);
    setError("");

    const res = await resetAccountPassword(account.id);
    setResetting(false);

    if (!res.success) {
      setError(res.message);
      return;
    }

    setNewPassword(res.password!);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-bmos-primary bg-bmos-primary-soft rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light hover:text-white transition cursor-pointer"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 text-left">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-bmos-text mb-1">
              Edit Akun
            </h2>
            <p className="text-xs text-bmos-text-light mb-4">
              {account.email}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                    Kode Laoshi{" "}
                    <span className="text-bmos-text-light font-normal">
                      (dari halaman Teachers, misal L001)
                    </span>
                  </label>
                  <input
                    value={teacherCode}
                    onChange={(e) => setTeacherCode(e.target.value)}
                    placeholder="L001"
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                  {teacherCode.trim() && (
                    <p
                      className={`text-xs mt-1 ${
                        matchedTeacher ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {matchedTeacher
                        ? `✓ Kehubung ke: ${matchedTeacher.name}`
                        : "Kode tidak ditemukan."}
                    </p>
                  )}
                </div>
              )}

              {roles.includes("STUDENT") && (
                <div>
                  <label className="block text-sm font-medium text-bmos-text mb-1">
                    Kode Murid{" "}
                    <span className="text-bmos-text-light font-normal">
                      (dari halaman Students, misal M0001)
                    </span>
                  </label>
                  <input
                    value={studentCode}
                    onChange={(e) => setStudentCode(e.target.value)}
                    placeholder="M0001"
                    className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                  />
                  {studentCode.trim() && (
                    <p
                      className={`text-xs mt-1 ${
                        matchedStudent ? "text-green-700" : "text-red-600"
                      }`}
                    >
                      {matchedStudent
                        ? `✓ Kehubung ke: ${matchedStudent.name}`
                        : "Kode tidak ditemukan."}
                    </p>
                  )}
                </div>
              )}

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
              </div>

              <div className="border-t border-bmos-border pt-4">
                <label className="block text-sm font-medium text-bmos-text mb-2">
                  Lupa password?
                </label>
                {newPassword ? (
                  <div className="bg-bmos-primary-soft/40 rounded-xl p-3 space-y-1">
                    <p className="text-xs text-bmos-text-light">
                      Password baru (cuma muncul sekali di sini, catat &amp;
                      kirim ke orangnya sekarang):
                    </p>
                    <p className="font-mono font-semibold text-bmos-text">
                      {newPassword}
                    </p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleResetPassword}
                    disabled={resetting}
                    className="text-xs font-semibold text-bmos-primary bg-bmos-primary-soft rounded-lg px-3 py-1.5 hover:bg-bmos-primary-light hover:text-white transition cursor-pointer disabled:opacity-50"
                  >
                    {resetting ? "Mereset..." : "Reset Password"}
                  </button>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAndReset}
                  className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
