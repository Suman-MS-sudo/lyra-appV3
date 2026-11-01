'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { HeroSection } from '@/components/landing/hero-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
import { AboutSection } from '@/components/landing/about-section';
import { FeaturesSection } from '@/components/landing/features-section';
import { ContactSection } from '@/components/landing/contact-section';
import { Footer } from '@/components/landing/footer';
import { MachinePayment } from '@/components/pay/MachinePayment';

function HomeContent() {
  // The QR on each machine's display opens /?value=<machine id> — that's the payment page.
  const machineId = useSearchParams().get('value');
  if (machineId) return <MachinePayment machineId={machineId} />;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <main>
        <HeroSection />
        <HowItWorksSection />
        <FeaturesSection />
        <AboutSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--line-strong)] border-t-[var(--accent)] animate-spin motion-reduce:animate-none" role="status" aria-label="Loading" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
