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
          <p className="text-xs font-semibold tracking-widest uppercase mb-3" style={{ color: '#F472B6' }}>Advanced Features</p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Smart Technology for Modern Needs</h2>
          <p className="mt-5 text-lg" style={{ color: 'rgba(255,255,255,0.50)' }}>
            Our IoT-enabled vending machines combine cutting-edge technology with user-friendly design.
          </p>
        </div>

        <div className="mx-auto max-w-6xl grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="rounded-3xl px-7 py-8 lyra-card"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
                style={{ background: 'rgba(244,63,94,0.18)', border: '1px solid rgba(244,63,94,0.28)' }}
              >
                <feature.icon className="h-6 w-6" style={{ color: '#F472B6' }} aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-white mb-2">{feature.name}</h3>
              <p className="text-sm leading-7" style={{ color: 'rgba(255,255,255,0.48)' }}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(to right, transparent 0%, rgba(244,63,94,0.20) 35%, rgba(167,139,250,0.20) 65%, transparent 100%)' }}
      />
    </section>
  );
}
