import Link from 'next/link';
import { ArrowRight, QrCode } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 pb-24 sm:pt-36 sm:pb-32 bg-white">
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Live badge */}
        <div className="flex justify-center mb-7 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-[#f5f5f7] text-[#6e6e73]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]" />
            Scan. Pay. Dispensed in seconds.
          </div>
        </div>

        {/* Headline — signature: oversized, tight-tracking confident type */}
        <div className="mx-auto max-w-4xl text-center">
          <h1
            className="text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl text-[#1d1d1f] animate-float-up"
            style={{ lineHeight: 1.02, letterSpacing: '-0.03em', animationDelay: '0.12s' }}
          >
            A sanitary napkin,
            <br />
            <span className="text-[#6e6e73]">whenever you need one.</span>
          </h1>
          <p
            className="mt-8 text-lg leading-8 sm:text-xl animate-float-up text-[#6e6e73] max-w-2xl mx-auto"
            style={{ animationDelay: '0.22s' }}
          >
            This page is what opens when you scan the QR code on a Lyra vending machine.
            No app to install, no cash — pick a product, pay by UPI or card, and it drops
            in seconds.
          </p>
          <div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-float-up"
            style={{ animationDelay: '0.32s' }}
          >
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 min-h-11 text-base font-semibold text-white bg-[#1d1d1f] transition-transform active:scale-[0.97]"
            >
              <QrCode className="h-5 w-5" />
              See how it works
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 min-h-11 text-base font-semibold text-[#1d1d1f] border border-[#d2d2d7] transition-transform active:scale-[0.97]"
            >
              Business / Admin Login
              <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
          <p className="mt-6 text-xs text-[#86868b] animate-float-up" style={{ animationDelay: '0.38s' }}>
            Already at a machine? Open your phone&apos;s camera and point it at the QR code — this page opens automatically.
          </p>
        </div>
      </div>
    </section>
  );
}
