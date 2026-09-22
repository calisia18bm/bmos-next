import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Foto bukti transfer & gambar konten disimpen di Supabase Storage
    // (domain <project-ref>.supabase.co) -- daftarin di sini biar
    // next/image bisa otomatis kecilin ukurannya sebelum dikirim ke
    // browser (jauh lebih ringan daripada <img> biasa yang selalu
    // ngirim file aslinya utuh).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
