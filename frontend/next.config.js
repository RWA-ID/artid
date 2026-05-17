/** @type {import('next').NextConfig} */
module.exports = {
  output: "export",
  trailingSlash: true,         // IPFS gateways serve directories nicely
  images: { unoptimized: true }, // no server image optimizer
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
};
