/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zaqvcpehhmkiyjdbcufj.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'mercamesa.com',
      },
    ],
  },
};

export default nextConfig;