import Link from 'next/link';
import { Footer } from '@/components/landing/footer';

export const metadata = {
  title: 'Terms of Service - Lyra Enterprises',
  description: 'Terms of Service for Lyra Enterprises IoT Vending Solutions',
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="text-lg font-bold text-gray-900">Lyra</div>
                <div className="text-xs text-gray-500">Enterprises</div>
              </div>
            </Link>
            <Link 
              href="/"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6 py-12 max-w-4xl">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">Terms of Service</h1>
          
          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 space-y-8">
            {/* Overview */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">1. Overview</h2>
              <p className="text-gray-700 leading-relaxed">
                This website is operated by Lyra Enterprises. Throughout the site, the terms &quot;we&quot;, &quot;us&quot; and &quot;our&quot; refer 
                to Lyra Enterprises. By visiting our site and/or purchasing something from us, you engage in our &quot;Service&quot; and agree 
                to be bound by the following terms and conditions (&quot;Terms of Service&quot;, &quot;Terms&quot;).
              </p>
            </section>

            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 1 - ONLINE STORE TERMS</h2>
              <p className="text-gray-700 leading-relaxed">
                By agreeing to these Terms of Service, you represent that you are at least the age of majority in your state or 
                province of residence. You may not use our products for any illegal or unauthorized purpose nor may you, in the use 
                of the Service, violate any laws in your jurisdiction.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 2 - GENERAL CONDITIONS</h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  We reserve the right to refuse service to anyone for any reason at any time. You understand that your content 
                  (not including credit card information), may be transferred unencrypted and involve transmissions over various 
                  networks. Credit card information is always encrypted during transfer over networks.
                </p>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 3 - ACCURACY OF INFORMATION</h2>
              <p className="text-gray-700 leading-relaxed">
                We are not responsible if information made available on this site is not accurate, complete or current. The material 
                on this site is provided for general information only and should not be relied upon or used as the sole basis for 
                making decisions without consulting primary sources.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 4 - MODIFICATIONS TO SERVICE AND PRICES</h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  Prices for our products are subject to change without notice. We reserve the right at any time to modify or 
                  discontinue the Service (or any part thereof) without notice at any time.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 5 - PRODUCTS OR SERVICES</h2>
              <p className="text-gray-700 leading-relaxed">
                Certain products or services may be available exclusively online through the website. These products or services 
                may have limited quantities and are subject to return or exchange only according to our Return Policy.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 6 - BILLING AND ACCOUNT INFORMATION</h2>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to refuse any order you place with us. We may, in our sole discretion, limit or cancel 
                quantities purchased per person, per household or per order.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 7 - DISCLAIMER OF WARRANTIES</h2>
              <p className="text-gray-700 leading-relaxed">
                We do not guarantee, represent or warrant that your use of our service will be uninterrupted, timely, secure or 
                error-free. We do not warrant that the results that may be obtained from the use of the service will be accurate 
                or reliable.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 8 - GOVERNING LAW</h2>
              <p className="text-gray-700 leading-relaxed">
                These Terms of Service and any separate agreements whereby we provide you Services shall be governed by and 
                construed in accordance with the laws of India and jurisdiction of Jaipur, Rajasthan.
              </p>
            </section>

            {/* Contact Information */}
            <section className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Contact Information</h2>
              <p className="text-gray-700 leading-relaxed">
                For questions about our Terms of Service, email us at{' '}
                <a href="mailto:lyraenterprisessales@gmail.com" className="text-blue-600 hover:underline">
                  lyraenterprisessales@gmail.com
                </a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
