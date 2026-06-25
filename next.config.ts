import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "pg", "ioredis"],
};
export default nextConfig;
