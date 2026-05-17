import { Heart, Users, Building2, School } from 'lucide-react';

export function AboutSection() {
  return (
    <section id="about" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#F472B6' }}>About Us</p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Revolutionizing Women&apos;s Hygiene Access
          </h2>
        </div>

        {/* Mission card */}
        <div className="mx-auto max-w-4xl mb-14">
          <div
            className="rounded-3xl px-8 py-10 sm:px-12"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-1"
                style={{ background: 'rgba(244,63,94,0.18)', border: '1px solid rgba(244,63,94,0.28)' }}
              >
                <Heart className="h-6 w-6" style={{ color: '#F472B6' }} fill="rgba(244,63,94,0.35)" />
              </div>
              <p className="text-lg leading-8" style={{ color: 'rgba(255,255,255,0.70)' }}>
                At{' '}
                <span className="font-semibold" style={{ color: '#F472B6' }}>Lyra Enterprises</span>, we empower
                women&apos;s hygiene through innovative sanitary napkin vending machines. We offer easy-to-use,
                cashless solutions for schools, workplaces, and public spaces, promoting menstrual health and
                accessibility.
              </p>
            </div>
          </div>
        </div>

        {/* Use cases */}
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: School,    label: 'Schools',       desc: 'Ensuring student wellness and dignity',  iconColor: '#A78BFA', iconBg: 'rgba(167,139,250,0.20)', iconBorder: 'rgba(167,139,250,0.30)' },
            { icon: Building2, label: 'Workplaces',    desc: 'Employee health and convenience',         iconColor: '#60A5FA', iconBg: 'rgba(96,165,250,0.20)',  iconBorder: 'rgba(96,165,250,0.30)'  },
            { icon: Users,     label: 'Public Spaces', desc: 'Accessible hygiene for everyone',         iconColor: '#F472B6', iconBg: 'rgba(244,63,94,0.18)',   iconBorder: 'rgba(244,63,94,0.28)'   },
            { icon: Heart,     label: 'Community',     desc: 'Breaking menstrual health stigma',        iconColor: '#F472B6', iconBg: 'rgba(236,72,153,0.18)',  iconBorder: 'rgba(236,72,153,0.28)'  },
          ].map(({ icon: Icon, label, desc, iconColor, iconBg, iconBorder }) => (
            <div
              key={label}
              className="flex flex-col items-center text-center rounded-3xl px-4 py-8 lyra-card"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
              >
                <Icon className="h-7 w-7" style={{ color: iconColor }} />
              </div>
              <h3 className="text-sm font-semibold text-white mb-1">{label}</h3>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent 0%, rgba(167,139,250,0.20) 35%, rgba(244,63,94,0.20) 65%, transparent 100%)' }}
      />
    </section>
  );
}
