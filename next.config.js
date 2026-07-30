/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Optimización de Vercel desactivada a propósito: las imágenes de
    // Supabase Storage se sirven como derivados WebP pre-generados en el
    // momento de subida (ver lib/images/generate.ts), no vía Image
    // Transformations ni el optimizador de Vercel/Next — ambos facturan por
    // imagen origen procesada y ya se había agotado ese cupo dos veces.
    unoptimized: true,
  },
};

export default nextConfig;