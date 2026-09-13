/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Le bon de dépôt peut embarquer plusieurs photos de pièces.
    serverActions: { bodySizeLimit: '4mb' },
  },
};

export default nextConfig;
