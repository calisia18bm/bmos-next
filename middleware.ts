import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// PENTING: file ini WAJIB ada di root project buat setup login Supabase
// yang dipakai (lib/supabase/server.ts & client.ts). Tanpa middleware ini,
// token login user ga pernah di-refresh otomatis -- begitu token-nya
// kadaluarsa (biasanya ~1 jam), semua halaman yang minta profil user
// (getCurrentProfile di lib/auth.ts) bakal dapet "user: null" walau
// user-nya masih beneran login, jadi keliatan kayak ke-logout / muncul
// "Akun belum diaktifkan" padahal cuma sesinya yang stale.
//
// supabase.auth.getUser() di bawah ini yang nge-trigger refresh token
// kalau perlu, terus cookie session yang udah di-refresh itu ditempelin
// ke response biar browser & request berikutnya pake yang baru.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request: { headers: request.headers } });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Panggilan ini yang beneran ngerjain refresh-nya -- HARUS getUser()
  // (bukan getSession()), karena getUser() yang validasi ke server
  // Supabase & trigger refresh token kalau access token-nya udah basi.
  await supabase.auth.getUser();

  return response;
}

// Jalanin middleware ini di SEMUA route KECUALI file statis (gambar,
// favicon, dll) & internal Next.js -- biar sesi ke-refresh di halaman
// manapun yang dibuka, bukan cuma sebagian.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
