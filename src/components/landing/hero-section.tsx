import Link from 'next/link';
import { ArrowRight, Shield, Zap, MapPin } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-purple-600 to-pink-500 text-white">
      <div className="absolute inset-0 bg-black/10"></div>
      
      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Empowering Women's Hygiene Through Innovation
          </h1>
          <p className="mt-6 text-lg leading-8 text-blue-50 sm:text-xl">
            IoT-enabled sanitary napkin vending machines for schools, workplaces, and public spaces. 
            Promoting menstrual health accessibility with easy-to-use, cashless solutions.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-purple-600 shadow-lg hover:bg-blue-50 transition-all hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Customer Login
              <ArrowRight className="ml-2 inline-block h-5 w-5" />
            </Link>
            <Link
              href="/login?type=admin"
              className="rounded-full border-2 border-white bg-transparent px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Admin Login
            </Link>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mx-auto mt-16 grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3 lg:mt-20">
          <div className="flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-sm px-6 py-8 text-center">
            <Shield className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-semibold">Secure & Hygienic</h3>
            <p className="mt-2 text-sm text-blue-50">Contactless dispensing with IoT monitoring</p>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-sm px-6 py-8 text-center">
            <Zap className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-semibold">Cashless Payments</h3>
            <p className="mt-2 text-sm text-blue-50">UPI, cards, and digital wallet support</p>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-white/10 backdrop-blur-sm px-6 py-8 text-center">
            <MapPin className="h-12 w-12 mb-4" />
            <h3 className="text-lg font-semibold">Wide Availability</h3>
            <p className="mt-2 text-sm text-blue-50">Schools, offices, and public spaces</p>
          </div>
        </div>
      </div>
    </section>
  );
}
