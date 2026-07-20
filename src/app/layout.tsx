import type { Metadata } from "next";
import { Outfit, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import PostHogProvider from "@/components/PostHogProvider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  weight: ["300", "400", "500", "600"],
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

// Cache-busted brand icons only (no unversioned /favicon.ico — browsers stick to
// the old create-next-app triangle forever if that path is ever served).
const ICON_V = "mm3";

export const metadata: Metadata = {
  title: "MicroManus — Deep Research Agent",
  description:
    "A deep research AI agent with web search, PDF reports, and usage-based billing.",
  icons: {
    icon: [
      { url: `/mm-icon.svg?v=${ICON_V}`, type: "image/svg+xml" },
      { url: `/mm-favicon.ico?v=${ICON_V}`, sizes: "any" },
    ],
    shortcut: `/mm-favicon.ico?v=${ICON_V}`,
    apple: [{ url: `/mm-apple-icon.png?v=${ICON_V}`, sizes: "180x180" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`h-full ${outfit.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Apply the saved theme + accent before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('mm-theme')||'dark';document.documentElement.setAttribute('data-theme',t);var a=localStorage.getItem('mm-accent');if(a&&a!=='indigo'){document.documentElement.setAttribute('data-accent',a);}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full antialiased bg-zinc-950 text-zinc-50 font-sans">
        <PostHogProvider />
        {children}
        <Toaster position="bottom-right" richColors />
      </body>
    </html>
  );
}
