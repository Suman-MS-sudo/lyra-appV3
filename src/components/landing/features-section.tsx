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
    <section id="features" className="relative py-24 sm:py-32 bg-white">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-[#6e6e73]">Advanced Features</p>
          <h2 className="text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-5xl">Smart Technology for Modern Needs</h2>
          <p className="mt-5 text-lg text-[#6e6e73]">
            Our IoT-enabled vending machines combine cutting-edge technology with user-friendly design.
          </p>
        </div>

        <div className="mx-auto max-w-6xl grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.name}
              className="rounded-2xl px-7 py-8 lyra-card border border-[#e5e5e7]"
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5 bg-[#f5f5f7]">
                <feature.icon className="h-6 w-6 text-[#1d1d1f]" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-2">{feature.name}</h3>
              <p className="text-sm leading-7 text-[#6e6e73]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
