import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships .afm font data files that must stay in node_modules (not bundled)
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
