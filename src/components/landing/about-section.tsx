import { Heart, Users, Building2, School } from 'lucide-react';

export function AboutSection() {
  return (
    <section id="about" className="relative py-24 sm:py-32 bg-[#f5f5f7]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-[#6e6e73]">About Us</p>
          <h2 className="text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-5xl">
            Revolutionizing Women&apos;s Hygiene Access
          </h2>
        </div>

        {/* Mission card */}
        <div className="mx-auto max-w-4xl mb-14">
          <div className="rounded-2xl px-8 py-10 sm:px-12 bg-white border border-[#e5e5e7]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-1 bg-[#f5f5f7]">
                <Heart className="h-6 w-6 text-[#1d1d1f]" />
              </div>
              <p className="text-lg leading-8 text-[#3a3a3c]">
                At <span className="font-semibold text-[#1d1d1f]">Lyra Enterprises</span>, we empower
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
            { icon: School,    label: 'Schools',       desc: 'Ensuring student wellness and dignity' },
            { icon: Building2, label: 'Workplaces',    desc: 'Employee health and convenience' },
            { icon: Users,     label: 'Public Spaces', desc: 'Accessible hygiene for everyone' },
            { icon: Heart,     label: 'Community',     desc: 'Breaking menstrual health stigma' },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex flex-col items-center text-center rounded-2xl px-4 py-8 lyra-card bg-white border border-[#e5e5e7]"
            >
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 bg-[#f5f5f7]">
                <Icon className="h-6 w-6 text-[#1d1d1f]" />
              </div>
              <h3 className="text-sm font-semibold text-[#1d1d1f] mb-1">{label}</h3>
              <p className="text-xs text-[#6e6e73]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
