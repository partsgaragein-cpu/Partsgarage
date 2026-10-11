/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.backblazeb2.com" },
    ],
  },
};

module.exports = nextConfig;
