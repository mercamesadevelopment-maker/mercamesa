/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Optimización de Vercel desactivada. Las imágenes de Supabase Storage
    // se transforman y cachean directamente con Supabase Image Transformations
    // (plan Pro). Las imágenes estáticas locales se sirven sin optimización.
    unoptimized: true,
  },
};

export default nextConfig;