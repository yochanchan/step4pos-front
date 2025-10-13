import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    // Reference a variable that was defined in the .env file and make it available at Build Time
    API_ENDPOINT: process.env.API_ENDPOINT,
  },
}

export default nextConfig;
