import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // BOM uploads (up to 10 MB) go through a server action; the default limit is 1 MB.
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
};

export default nextConfig;
