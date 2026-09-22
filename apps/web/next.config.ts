import type { NextConfig } from "next";

// Same-origin proxy to the FastAPI service: no CORS, and the browser never needs the API's address.
const API_URL = process.env.API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${API_URL}/api/v1/:path*` }];
  },
};

export default nextConfig;
