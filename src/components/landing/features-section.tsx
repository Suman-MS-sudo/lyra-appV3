import { Smartphone, WifiHigh, Bell, BarChart3, Lock, Sparkles } from 'lucide-react';

const features = [
  { name: 'IoT Connectivity',     description: 'Real-time monitoring and inventory management through advanced IoT sensors.',         icon: WifiHigh  },
  { name: 'Smart Notifications',  description: 'Automated alerts for low stock, maintenance needs, and transaction updates.',         icon: Bell      },
  { name: 'Mobile App Control',   description: 'Manage machines, view analytics, and process payments from anywhere.',                icon: Smartphone },
  { name: 'Analytics Dashboard',  description: 'Comprehensive insights into usage patterns, revenue, and inventory trends.',          icon: BarChart3  },
  { name: 'Secure Transactions',  description: 'End-to-end encrypted payments with multiple payment gateway support.',                icon: Lock      },
  { name: 'Premium Quality',      description: 'Hygienic dispensing with quality-certified sanitary napkin products.',                icon: Sparkles  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#2563EB' }}>Advanced Features</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Smart Technology for Modern Needs</h2>
          <p className="mt-5 text-lg" style={{ color: '#64748b' }}>
            Our IoT-enabled vending machines combine cutting-edge technology with user-friendly design.
          </p>
        </div>

        <div className="mx-auto max-w-6xl grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="rounded-3xl px-7 py-8 lyra-card"
              style={{ background: '#ffffff', border: '1px solid #e2e8f0' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(37,99,235,0.10)', border: '1px solid rgba(37,99,235,0.22)' }}
              >
                <feature.icon className="h-6 w-6" style={{ color: '#2563EB' }} aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-2">{feature.name}</h3>
              <p className="text-sm leading-7" style={{ color: '#64748b' }}>{feature.description}</p>
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
