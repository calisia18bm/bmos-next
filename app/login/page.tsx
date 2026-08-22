"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getCharacterFile } from "@/lib/characters";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Logo di halaman Login ngikutin karakter yang dipilih Owner di sidebar
  // (app_settings.global_character_key) -- diambil lewat endpoint publik
  // karena belum login, jadi ga bisa query app_settings langsung (RLS-nya
  // butuh login). Default-nya karakter pertama di katalog kalau belum
  // pernah diatur / lagi gagal fetch.
  const [characterFile, setCharacterFile] = useState(getCharacterFile(null));

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/character")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCharacterFile(getCharacterFile(data?.key ?? null));
      })
      .catch(() => {
        // Biarin default kalau gagal fetch -- jangan bikin halaman Login
        // error cuma gara-gara logo.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      setError("Email atau password salah.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-bmos-primary-soft flex items-center justify-center mx-auto mb-4">
            <Image
              src={characterFile}
              alt="BM Mandarin"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
          <h1 className="text-2xl font-extrabold text-bmos-text">BMOS</h1>
          <p className="text-bmos-text-light text-sm">BM Mandarin</p>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white border border-bmos-border rounded-2xl p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-bmos-text mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
              placeholder="nama@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-bmos-text mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-bmos-primary text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </div>
    </div>
  );
}
