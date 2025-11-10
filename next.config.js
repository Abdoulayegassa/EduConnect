/**@type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: true, // ✅ requis pour Next 13.5.x
  },
};

module.exports = nextConfig;
