import { Smartphone, WifiHigh, Bell, BarChart3, Lock, Sparkles } from 'lucide-react';

const features = [
  {
    name: 'IoT Connectivity',
    description: 'Real-time monitoring and inventory management through advanced IoT sensors.',
    icon: WifiHigh,
  },
  {
    name: 'Smart Notifications',
    description: 'Automated alerts for low stock, maintenance needs, and transaction updates.',
    icon: Bell,
  },
  {
    name: 'Mobile App Control',
    description: 'Manage machines, view analytics, and process payments from anywhere.',
    icon: Smartphone,
  },
  {
    name: 'Analytics Dashboard',
    description: 'Comprehensive insights into usage patterns, revenue, and inventory trends.',
    icon: BarChart3,
  },
  {
    name: 'Secure Transactions',
    description: 'End-to-end encrypted payments with multiple payment gateway support.',
    icon: Lock,
  },
  {
    name: 'Premium Quality',
    description: 'Hygienic dispensing with quality-certified sanitary napkin products.',
    icon: Sparkles,
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="bg-gray-50 py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-purple-600">Advanced Features</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Smart Technology for Modern Needs
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Our IoT-enabled vending machines combine cutting-edge technology with user-friendly design.
          </p>
        </div>
        <div className="mx-auto mt-16 max-w-6xl">
          <dl className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="relative rounded-2xl bg-white px-8 py-10 shadow-sm hover:shadow-md transition-shadow">
                <dt className="flex items-center gap-4">
                  <div className="rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 p-3 text-white">
                    <feature.icon className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div className="text-lg font-semibold leading-7 text-gray-900">
                    {feature.name}
                  </div>
                </dt>
                <dd className="mt-4 text-base leading-7 text-gray-600">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
