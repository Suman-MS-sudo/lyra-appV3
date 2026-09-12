import { MapPin, Mail, Phone } from 'lucide-react';

export function ContactSection() {
  return (
    <section id="contact" className="relative py-24 sm:py-32 bg-[#f5f5f7]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center mb-16">
          <p className="text-xs font-semibold tracking-widest uppercase mb-3 text-[#6e6e73]">Get in Touch</p>
          <h2 className="text-4xl font-semibold tracking-tight text-[#1d1d1f] sm:text-5xl">Contact Lyra Enterprises</h2>
          <p className="mt-5 text-lg text-[#6e6e73]">
            Ready to bring our innovative vending solutions to your location? We&apos;d love to hear from you.
          </p>
        </div>

        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="flex flex-col items-center rounded-2xl px-6 py-10 text-center lyra-card bg-white border border-[#e5e5e7]">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-[#f5f5f7]">
                <MapPin className="h-6 w-6 text-[#1d1d1f]" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-3">Visit Us</h3>
              <p className="text-sm leading-relaxed text-[#3a3a3c]">
                10/21, Vasuki Street,<br />
                Cholapuram, Ambattur,<br />
                Chennai - 600053<br />
                <span className="text-xs text-[#86868b]">(Near Municipal School)</span>
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl px-6 py-10 text-center lyra-card bg-white border border-[#e5e5e7]">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-[#f5f5f7]">
                <Mail className="h-6 w-6 text-[#1d1d1f]" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-3">Email Us</h3>
              <a
                href="mailto:lyraenterprisessales@gmail.com"
                className="text-sm font-medium break-all text-[#0071e3] hover:underline"
              >
                lyraenterprisessales@gmail.com
              </a>
            </div>

            <div className="flex flex-col items-center rounded-2xl px-6 py-10 text-center lyra-card bg-white border border-[#e5e5e7]">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 bg-[#f5f5f7]">
                <Phone className="h-6 w-6 text-[#1d1d1f]" />
              </div>
              <h3 className="text-base font-semibold text-[#1d1d1f] mb-3">Call Us</h3>
              <a
                href="tel:+918122378860"
                className="text-sm font-medium text-[#0071e3] hover:underline"
              >
                +91 81223 78860
              </a>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-14 text-center">
            <p className="text-base mb-6 text-[#6e6e73]">
              Interested in partnering with us or installing a vending machine at your facility?
            </p>
            <a
              href="mailto:lyraenterprisessales@gmail.com"
              className="inline-flex items-center rounded-full px-8 py-3.5 min-h-11 text-base font-semibold text-white bg-[#1d1d1f] transition-transform active:scale-[0.97]"
            >
              Get Started Today
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
