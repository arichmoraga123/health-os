import type { Metadata } from "next";
import { Bebas_Neue, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const ibmPlex = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const bebas = Bebas_Neue({
  variable: "--font-bebas-neue",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Health OS",
  description: "Full-stack health analytics platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlex.variable} ${bebas.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--text)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
