/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sharp usa un binario nativo por plataforma; si Next lo empaqueta/tracea
  // para las funciones serverless en vez de dejarlo resolver por require()
  // normal, en Vercel (Linux) puede terminar generando derivados WebP
  // corruptos sin lanzar ningún error (bug detectado en producción).
  serverExternalPackages: ['sharp'],
  images: {
    // Optimización de Vercel desactivada a propósito: las imágenes de
    // Supabase Storage se sirven como derivados WebP pre-generados en el
    // momento de subida (ver lib/images/generate.ts), no vía Image
    // Transformations ni el optimizador de Vercel/Next — ambos facturan por
    // imagen origen procesada y ya se había agotado ese cupo dos veces.
    unoptimized: true,
  },
  // Productos, Tiendas y Plazas estaban dentro de «Secciones» (`/sections/...`) y
  // pasaron a ser módulos como los demás. Los enlaces viejos (compartidos,
  // guardados, la app instalada) siguen funcionando. Next aplica esto antes que
  // el proxy, así que el permiso se revisa sobre la ruta nueva.
  async redirects() {
    return [
      { source: '/sections/products', destination: '/products', permanent: true },
      { source: '/sections/stores', destination: '/stores', permanent: true },
      // El directorio de plazas se unificó con la página de plazas.
      { source: '/sections/marketplaces', destination: '/marketplaces', permanent: true },
      { source: '/sections', destination: '/marketplaces', permanent: true },
    ];
  },
  // El service worker nunca se guarda en caché: si el navegador se quedara con
  // una versión vieja, la app instalada no recibiría los cambios.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;