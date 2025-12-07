import { MapPin, Mail, Phone } from 'lucide-react';

export function ContactSection() {
  return (
    <section id="contact" className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-base font-semibold leading-7 text-purple-600">Get in Touch</h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Contact Lyra Enterprises
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600">
            Ready to bring our innovative vending solutions to your location? We'd love to hear from you.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 px-6 py-10 text-center">
              <div className="rounded-full bg-white p-4 mb-4 shadow-sm">
                <MapPin className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Visit Us</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                10/21, Vasuki Street,<br />
                Cholapuram, Ambattur,<br />
                Chennai - 600053<br />
                <span className="text-xs text-gray-500">(Near Municipal School)</span>
              </p>
            </div>

            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 px-6 py-10 text-center">
              <div className="rounded-full bg-white p-4 mb-4 shadow-sm">
                <Mail className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Email Us</h3>
              <a 
                href="mailto:lyraenterprisessales@gmail.com" 
                className="text-sm text-blue-600 hover:text-blue-700 font-medium break-all"
              >
                lyraenterprisessales@gmail.com
              </a>
            </div>

            <div className="flex flex-col items-center rounded-2xl bg-gradient-to-br from-blue-50 to-purple-50 px-6 py-10 text-center">
              <div className="rounded-full bg-white p-4 mb-4 shadow-sm">
                <Phone className="h-8 w-8 text-pink-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Call Us</h3>
              <a 
                href="tel:+918122378860" 
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                +91 81223 78860
              </a>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <p className="text-base text-gray-600 mb-6">
              Interested in partnering with us or installing a vending machine at your facility?
            </p>
            <a
              href="mailto:lyraenterprisessales@gmail.com"
              className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:from-blue-700 hover:to-purple-700 transition-all hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600"
            >
              Get Started Today
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
