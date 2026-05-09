/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zaqvcpehhmkiyjdbcufj.supabase.co',
      },
    ],
  },
};

export default nextConfig;