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

export const metadata: Metadata = {
  title: "MicroManus — Deep Research Agent",
  description:
    "A deep research AI agent with web search, PDF reports, and usage-based billing.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
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
