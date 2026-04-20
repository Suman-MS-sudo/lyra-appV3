import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lyra - Smart Vending Machine Management",
  description: "Enterprise-grade vending machine management system with real-time monitoring, inventory tracking, and analytics",
  keywords: ["vending machine", "inventory management", "IoT", "smart machines", "automated retail"],
  authors: [{ name: "Lyra" }],
  openGraph: {
    title: "Lyra - Smart Vending Machine Management",
    description: "Enterprise-grade vending machine management system",
    url: "https://lyra-app.co.in",
    siteName: "Lyra",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-white dark:bg-gray-950 text-gray-900 dark:text-white transition-colors`}
      >
        {children}
      </body>
    </html>
  );
}
