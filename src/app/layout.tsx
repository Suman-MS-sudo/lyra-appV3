import type { Metadata } from "next";
import { Geist_Mono, Inter, Inter_Tight, Plus_Jakarta_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import "./console-theme.css";

const inter = Inter({
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display face: Inter Tight (variable weight) — the tighter display cut of
// Inter, so headings and body read as one family. Has the ₹ sign.
const displayFont = Inter_Tight({
  variable: "--font-display-grotesk",
  subsets: ["latin"],
});

// Console face (admin & customer panels)
const jakarta = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lyra Pay — UPI payments for Lyra sanitary napkin vending machines",
  description: "Scan the QR on a Lyra sanitary napkin vending machine, pay with any UPI app, and the machine dispenses in seconds. Operator console for institutions.",
  keywords: ["sanitary napkin vending machine", "UPI payment", "QR payment", "Lyra Enterprises", "vending machine dashboard"],
  authors: [{ name: "Lyra" }],
  openGraph: {
    title: "Lyra Pay — UPI payments for Lyra vending machines",
    description: "Scan the machine QR, pay by UPI, napkin dispensed.",
    url: "https://lyra-app.co.in",
    siteName: "Lyra",
    type: "website",
  },
};

// Runs before first paint so the saved (or OS) theme never flashes the wrong one.
const THEME_SCRIPT = `try{var t=localStorage.getItem('lyra-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d)}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className={`${inter.variable} ${displayFont.variable} ${jakarta.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
