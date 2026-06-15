import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["xupra.lvh.me"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
