import Link from 'next/link';
import { ArrowRight, Shield, Zap, MapPin } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-28 pb-24 sm:pt-36 sm:pb-32">
      {/* Glow blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-[560px] h-[560px] rounded-full animate-glow-drift-1"
          style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 65%)' }}
        />
        <div
          className="absolute top-1/2 -left-32 w-96 h-96 rounded-full animate-glow-drift-2"
          style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.18) 0%, transparent 65%)', animationDelay: '2s' }}
        />
        <div
          className="absolute bottom-0 right-1/3 w-80 h-80 rounded-full animate-glow-drift-3"
          style={{ background: 'radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 65%)', animationDelay: '4s' }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        {/* Live badge */}
        <div className="flex justify-center mb-7 animate-float-up" style={{ animationDelay: '0.05s' }}>
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase"
            style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.25)', color: '#1D4ED8' }}
          >
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#2563EB' }} />
            Smart Hygiene Access
          </div>
        </div>

        {/* Headline */}
        <div className="mx-auto max-w-3xl text-center">
          <h1
            className="text-4xl font-black tracking-tight sm:text-6xl lg:text-7xl text-slate-900 animate-float-up"
            style={{ lineHeight: 1.1, animationDelay: '0.12s' }}
          >
            Empowering Women&apos;s Hygiene{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #93C5FD, #2563EB, #1D4ED8)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              Through Innovation
            </span>
          </h1>
          <p
            className="mt-6 text-lg leading-8 sm:text-xl animate-float-up"
            style={{ color: '#475569', animationDelay: '0.22s' }}
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
              className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-base font-semibold text-white transition-all active:scale-[0.97] btn-glow"
              style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
            >
              Customer Login
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/login?type=admin"
              className="inline-flex items-center rounded-full px-8 py-3.5 text-base font-semibold transition-all active:scale-[0.97]"
              style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', color: '#334155' }}
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
              className="flex flex-col items-center rounded-3xl px-6 py-8 text-center lyra-card animate-card-enter"
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 4px 24px rgba(15,23,42,0.05)',
                animationDelay: delay,
              }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.22)' }}
              >
                <Icon className="h-7 w-7" style={{ color: '#2563EB' }} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-2">{title}</h3>
              <p className="text-xs" style={{ color: '#64748b' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom separator */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent 0%, rgba(37,99,235,0.22) 35%, rgba(96,165,250,0.22) 65%, transparent 100%)' }}
      />
    </section>
  );
}
