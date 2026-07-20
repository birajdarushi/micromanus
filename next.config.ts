import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships .afm font data files that must stay in node_modules (not bundled);
  // sharp has native bindings and must not be bundled either.
  serverExternalPackages: ["pdfkit", "sharp", "nodemailer"],
  // Legacy /favicon.ico → brand icon (no long-lived cache on the bare path)
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/mm-favicon.ico" }];
  },
  async headers() {
    return [
      {
        source: "/favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
      {
        source: "/mm-favicon.ico",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/mm-icon.svg",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/mm-apple-icon.png",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
