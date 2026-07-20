import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit ships .afm font data files that must stay in node_modules (not bundled);
  // sharp has native bindings and must not be bundled either.
  serverExternalPackages: ["pdfkit", "sharp", "nodemailer"],
};

export default nextConfig;
