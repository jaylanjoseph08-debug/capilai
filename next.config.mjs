/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["stripe", "@supabase/supabase-js"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("stripe", "@supabase/supabase-js");
    }
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
