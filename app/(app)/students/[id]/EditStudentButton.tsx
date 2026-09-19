"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateStudent,
  getLinkedAccount,
  createAccountForStudent,
} from "../actions";
import { resetAccountPassword, updateAccountEmail } from "../../accounts/actions";

type ClassOption = { id: string; name: string; teacher_name: string | null };

type StudentData = {
  id: string;
  name: string;
  phone: string | null;
  class_id: string | null;
  sessions_per_package: number | null;
  package_price: number | null;
  status: string;
  notes: string | null;
};

export default function EditStudentButton({
  student,
  classes,
}: {
  student: StudentData;
  classes: ClassOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(student.name);
  const [phone, setPhone] = useState(student.phone || "");
  const [classId, setClassId] = useState(student.class_id || "");
  const [sessions, setSessions] = useState(String(student.sessions_per_package || 4));
  const [price, setPrice] = useState(String(student.package_price || 0));
  const [status, setStatus] = useState(student.status);
  const [notes, setNotes] = useState(student.notes || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Status akun login murid ini -- undefined = belum dicek, null = udah
  // dicek tapi ga ada (atau yang buka bukan Owner, section-nya nanti
  // disembunyiin), object = ada akun kesambung.
  const [accountSectionVisible, setAccountSectionVisible] = useState(false);
  const [linkedAccount, setLinkedAccount] = useState<{ id: string; email: string } | null>(null);
  const [accountLoading, setAccountLoading] = useState(false);

  // Dipakai kalau murid ini BELUM punya akun -- Owner bisa langsung
  // bikinin dari sini juga.
  const [createAccount, setCreateAccount] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newAccountPassword, setNewAccountPassword] = useState("");
  const [newAccountResult, setNewAccountResult] = useState<{ email: string; password: string } | null>(null);
  const [newAccountError, setNewAccountError] = useState("");
  const [newAccountLoading, setNewAccountLoading] = useState(false);

  // Dipakai kalau murid ini SUDAH punya akun -- ganti email / reset
  // password akun yang udah ada, terpisah dari form Simpan Perubahan utama.
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [changeEmailValue, setChangeEmailValue] = useState("");
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetPasswordResult, setResetPasswordResult] = useState("");

  // Password minimal 6 karakter (aturan Supabase Auth) -- dicek di sini
  // juga (bukan cuma di server) biar tombol Simpan langsung ke-disable
  // dan ga bisa diklik kalau passwordnya kependekan, daripada baru
  // ketahuan gagal setelah submit.
  const passwordTooShort =
    createAccount && newAccountPassword.trim().length > 0 && newAccountPassword.trim().length < 6;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAccountLoading(true);
    getLinkedAccount(student.id).then((res) => {
      if (cancelled) return;
      setAccountLoading(false);
      if (res.visible) {
        setAccountSectionVisible(true);
        setLinkedAccount(res.account);
      } else {
        setAccountSectionVisible(false);
        setLinkedAccount(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, student.id]);

  function resetAccountUiState() {
    setCreateAccount(false);
    setNewEmail("");
    setNewAccountPassword("");
    setNewAccountResult(null);
    setNewAccountError("");
    setShowChangeEmail(false);
    setChangeEmailValue("");
    setEmailChangeError("");
    setResetError("");
    setResetPasswordResult("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const selectedClass = classes.find((c) => c.id === classId);

    const result = await updateStudent(student.id, {
      name,
      phone,
      classId,
      className: selectedClass?.name || "",
      teacherName: selectedClass?.teacher_name || "",
      sessionsPerPackage: sessions,
      packagePrice: price,
      status,
      notes,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    // Kalau murid ini belum punya akun dan Owner centang "buatkan akun
    // login" -- bikin akunnya sekarang, sesudah data muridnya kesimpen.
    if (!linkedAccount && createAccount && newEmail && !passwordTooShort) {
      setNewAccountLoading(true);
      const accountResult = await createAccountForStudent(student.id, {
        name,
        email: newEmail,
        password: newAccountPassword,
      });
      setNewAccountLoading(false);

      if (!accountResult.success) {
        // Data murid tetap tersimpan -- cuma akunnya yang gagal dibuat.
        // Modal ga langsung ditutup, ditampilin dulu alasannya.
        setNewAccountError(accountResult.message);
        return;
      }

      setNewAccountResult({
        email: accountResult.email!,
        password: accountResult.password!,
      });
      router.refresh();
      return;
    }

    setOpen(false);
    resetAccountUiState();
    router.refresh();
  }

  async function handleChangeEmail() {
    if (!linkedAccount) return;
    setEmailChangeLoading(true);
    setEmailChangeError("");

    const result = await updateAccountEmail(linkedAccount.id, changeEmailValue);
    setEmailChangeLoading(false);

    if (!result.success) {
      setEmailChangeError(result.message);
      return;
    }

    setLinkedAccount({ id: linkedAccount.id, email: result.email! });
    setShowChangeEmail(false);
    router.refresh();
  }

  async function handleResetPassword() {
    if (!linkedAccount) return;
    setResetLoading(true);
    setResetError("");
    setResetPasswordResult("");

    const result = await resetAccountPassword(linkedAccount.id);
    setResetLoading(false);

    if (!result.success) {
      setResetError(result.message);
      return;
    }

    setResetPasswordResult(result.password!);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="bg-white border border-bmos-border text-bmos-text rounded-xl px-4 py-2.5 text-sm font-semibold hover:bg-bmos-primary-soft transition"
      >
        ✏️ Edit
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            {newAccountResult ? (
              <>
                <h2 className="text-lg font-bold text-bmos-text mb-1">
                  Akun berhasil dibuat
                </h2>
                <p className="text-sm text-bmos-text-light mb-4">
                  Kirim info login ini ke muridnya (lewat WhatsApp misalnya).
                  Password ini cuma muncul sekali di sini, catat sekarang
                  sebelum ditutup.
                </p>
                <div className="bg-bmos-primary-soft/40 rounded-xl p-4 space-y-2 mb-4">
                  <p className="text-sm">
                    <span className="text-bmos-text-light">Email: </span>
                    <span className="font-semibold text-bmos-text">
                      {newAccountResult.email}
                    </span>
                  </p>
                  <p className="text-sm">
                    <span className="text-bmos-text-light">Password: </span>
                    <span className="font-semibold text-bmos-text font-mono">
                      {newAccountResult.password}
                    </span>
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      resetAccountUiState();
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
                  Edit Data Murid
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Nama Murid
                    </label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      No. HP
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Kelas
                    </label>
                    <select
                      value={classId}
                      onChange={(e) => setClassId(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    >
                      <option value="">Belum ada kelas</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.teacher_name})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-bmos-text mb-1">
                        Sesi per Paket
                      </label>
                      <input
                        type="number"
                        value={sessions}
                        onChange={(e) => setSessions(e.target.value)}
                        className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-bmos-text mb-1">
                        Harga Paket (Rp)
                      </label>
                      <input
                        type="number"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    >
                      <option value="ACTIVE">Aktif</option>
                      <option value="INACTIVE">Non-Aktif</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-bmos-text mb-1">
                      Catatan
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                    />
                  </div>

                  {accountLoading && (
                    <p className="text-xs text-bmos-text-light">
                      Memuat status akun login...
                    </p>
                  )}

                  {accountSectionVisible && !accountLoading && (
                    <div className="border-t border-bmos-border pt-4">
                      <p className="text-sm font-medium text-bmos-text mb-2">
                        Akun Login
                      </p>

                      {linkedAccount ? (
                        <div className="bg-bmos-primary-soft/30 rounded-xl p-3 space-y-3">
                          <p className="text-sm text-bmos-text">
                            Email:{" "}
                            <span className="font-semibold">{linkedAccount.email}</span>
                          </p>

                          {!showChangeEmail ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowChangeEmail(true);
                                  setChangeEmailValue(linkedAccount.email);
                                }}
                                className="text-xs font-semibold text-bmos-primary hover:underline"
                              >
                                Ganti Email
                              </button>
                              <button
                                type="button"
                                disabled={resetLoading}
                                onClick={handleResetPassword}
                                className="text-xs font-semibold text-bmos-primary hover:underline disabled:opacity-60"
                              >
                                {resetLoading ? "Mereset..." : "Reset Password"}
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <input
                                type="email"
                                value={changeEmailValue}
                                onChange={(e) => setChangeEmailValue(e.target.value)}
                                className="w-full border border-bmos-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={emailChangeLoading}
                                  onClick={handleChangeEmail}
                                  className="bg-bmos-primary text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                                >
                                  {emailChangeLoading ? "Menyimpan..." : "Simpan Email"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowChangeEmail(false)}
                                  className="text-xs text-bmos-text-light hover:text-bmos-text"
                                >
                                  Batal
                                </button>
                              </div>
                            </div>
                          )}

                          {emailChangeError && (
                            <p className="text-xs text-red-600">{emailChangeError}</p>
                          )}
                          {resetError && (
                            <p className="text-xs text-red-600">{resetError}</p>
                          )}
                          {resetPasswordResult && (
                            <p className="text-xs text-bmos-text bg-white border border-bmos-border rounded-lg px-2 py-1.5">
                              Password baru:{" "}
                              <span className="font-mono font-semibold">
                                {resetPasswordResult}
                              </span>{" "}
                              -- catat sekarang, cuma muncul sekali.
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <label className="flex items-center gap-2 text-sm font-medium text-bmos-text cursor-pointer">
                            <input
                              type="checkbox"
                              checked={createAccount}
                              onChange={(e) => setCreateAccount(e.target.checked)}
                              className="accent-bmos-primary"
                            />
                            Buatkan akun login sekarang?
                          </label>
                          <p className="text-[11px] text-bmos-text-light mt-1">
                            Murid ini belum punya akun login. Centang buat
                            langsung bikinin.
                          </p>

                          {createAccount && (
                            <div className="space-y-3 mt-3">
                              <div>
                                <label className="block text-sm font-medium text-bmos-text mb-1">
                                  Email
                                </label>
                                <input
                                  required={createAccount}
                                  type="email"
                                  value={newEmail}
                                  onChange={(e) => setNewEmail(e.target.value)}
                                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-bmos-text mb-1">
                                  Password{" "}
                                  <span className="text-bmos-text-light font-normal">
                                    (opsional -- kosongin aja kalau mau
                                    di-generate otomatis)
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  value={newAccountPassword}
                                  onChange={(e) => setNewAccountPassword(e.target.value)}
                                  placeholder="Minimal 6 karakter"
                                  className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
                                />
                                {passwordTooShort && (
                                  <p className="text-xs text-red-600 mt-1">
                                    Password minimal 6 karakter.
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {newAccountError && (
                            <p className="text-xs text-red-600 mt-2">{newAccountError}</p>
                          )}
                        </>
                      )}
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
                        resetAccountUiState();
                      }}
                      className="px-4 py-2 text-sm text-bmos-text-light hover:text-bmos-text"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={
                        loading ||
                        newAccountLoading ||
                        (createAccount && !linkedAccount && (!newEmail || passwordTooShort))
                      }
                      className="bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
                    >
                      {loading || newAccountLoading ? "Menyimpan..." : "Simpan Perubahan"}
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
