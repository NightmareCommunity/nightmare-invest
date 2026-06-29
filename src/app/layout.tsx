import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NIGHTMARE INVEST — Institutional Crypto Alpha",
  description:
    "Private access to institutional-grade crypto hedge fund strategies. Nightmare Alpha Crypto Fund — elite capital allocation for accredited investors.",
  keywords: [
    "crypto hedge fund",
    "institutional crypto",
    "alpha fund",
    "digital assets",
    "accredited investors",
  ],
  authors: [{ name: "Nightmare Invest" }],
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    title: "NIGHTMARE INVEST",
    description: "Private access to institutional crypto alpha.",
    siteName: "Nightmare Invest",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jetbrains.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
        <SonnerToaster
          position="top-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "rgba(20,20,22,0.9)",
              border: "1px solid rgba(212,175,55,0.2)",
              color: "#f5f5f4",
              backdropFilter: "blur(12px)",
            },
          }}
        />
      </body>
    </html>
  );
}
