import Link from 'next/link';
import { ArrowRight, Shield, Zap, MapPin } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 pb-24 sm:pt-36 sm:pb-32 bg-white">
      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Live badge */}
        <div className="flex justify-center mb-7 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-[#f5f5f7] text-[#6e6e73]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0071e3]" />
            Smart Hygiene Access
          </div>
        </div>

        {/* Headline — signature: oversized, tight-tracking confident type */}
        <div className="mx-auto max-w-4xl text-center">
          <h1
            className="text-5xl font-semibold tracking-tight sm:text-7xl lg:text-8xl text-[#1d1d1f] animate-float-up"
            style={{ lineHeight: 1.02, letterSpacing: '-0.03em', animationDelay: '0.12s' }}
          >
            Empowering Women&apos;s Hygiene
            <br />
            <span className="text-[#6e6e73]">Through Innovation</span>
          </h1>
          <p
            className="mt-8 text-lg leading-8 sm:text-xl animate-float-up text-[#6e6e73] max-w-2xl mx-auto"
            style={{ animationDelay: '0.22s' }}
          >
            IoT-enabled sanitary napkin vending machines for schools, workplaces, and public spaces.
            Promoting menstrual health accessibility with cashless, contactless solutions.
          </p>
          <div
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-float-up"
            style={{ animationDelay: '0.32s' }}
          >
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 min-h-11 text-base font-semibold text-white bg-[#1d1d1f] transition-transform active:scale-[0.97]"
            >
              Customer Login
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login?type=admin"
              className="inline-flex items-center rounded-full px-8 py-3.5 min-h-11 text-base font-semibold text-[#1d1d1f] border border-[#d2d2d7] transition-transform active:scale-[0.97]"
            >
              Admin Login
            </Link>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mx-auto mt-20 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { icon: Shield, title: 'Secure & Hygienic', desc: 'Contactless dispensing with IoT monitoring', delay: '0.42s' },
            { icon: Zap, title: 'Cashless Payments', desc: 'UPI, cards, and digital wallet support', delay: '0.52s' },
            { icon: MapPin, title: 'Wide Availability', desc: 'Schools, offices, and public spaces', delay: '0.62s' },
          ].map(({ icon: Icon, title, desc, delay }) => (
            <div
              key={title}
              className="flex flex-col items-center rounded-2xl px-6 py-8 text-center lyra-card animate-card-enter border border-[#e5e5e7]"
              style={{ animationDelay: delay }}
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[#f5f5f7]">
                <Icon className="h-6 w-6 text-[#1d1d1f]" />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f] mb-2">{title}</h3>
              <p className="text-xs text-[#6e6e73]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
