import { Heart, Users, Building2, School } from 'lucide-react';

export function AboutSection() {
  return (
    <section id="about" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#2563EB' }}>About Us</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Revolutionizing Women&apos;s Hygiene Access
          </h2>
        </div>

        {/* Mission card */}
        <div className="mx-auto max-w-4xl mb-14">
          <div
            className="rounded-3xl px-8 py-10 sm:px-12"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 24px rgba(15,23,42,0.05)',
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-1"
                style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.22)' }}
              >
                <Heart className="h-6 w-6" style={{ color: '#2563EB' }} fill="rgba(37,99,235,0.25)" />
              </div>
              <p className="text-lg leading-8" style={{ color: '#475569' }}>
                At{' '}
                <span className="font-semibold" style={{ color: '#2563EB' }}>Lyra Enterprises</span>, we empower
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
            { icon: School,    label: 'Schools',       desc: 'Ensuring student wellness and dignity',  iconColor: '#0EA5E9', iconBg: 'rgba(14,165,233,0.14)', iconBorder: 'rgba(14,165,233,0.28)' },
            { icon: Building2, label: 'Workplaces',    desc: 'Employee health and convenience',         iconColor: '#2563EB', iconBg: 'rgba(37,99,235,0.12)',  iconBorder: 'rgba(37,99,235,0.24)'  },
            { icon: Users,     label: 'Public Spaces', desc: 'Accessible hygiene for everyone',         iconColor: '#1D4ED8', iconBg: 'rgba(29,78,216,0.12)',   iconBorder: 'rgba(29,78,216,0.24)'   },
            { icon: Heart,     label: 'Community',     desc: 'Breaking menstrual health stigma',        iconColor: '#3B82F6', iconBg: 'rgba(59,130,246,0.12)',  iconBorder: 'rgba(59,130,246,0.24)'  },
          ].map(({ icon: Icon, label, desc, iconColor, iconBg, iconBorder }) => (
            <div
              key={label}
              className="flex flex-col items-center text-center rounded-3xl px-4 py-8 lyra-card"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
              >
                <Icon className="h-7 w-7" style={{ color: iconColor }} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 mb-1">{label}</h3>
              <p className="text-xs" style={{ color: '#64748b' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent 0%, rgba(37,99,235,0.18) 35%, rgba(96,165,250,0.18) 65%, transparent 100%)' }}
      />
    </section>
  );
}
