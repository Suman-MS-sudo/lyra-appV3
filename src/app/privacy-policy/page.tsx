import Link from 'next/link';
import { Footer } from '@/components/landing/footer';

export const metadata = {
  title: 'Privacy Policy - Lyra Enterprises',
  description: 'Privacy Policy for Lyra Enterprises IoT Vending Solutions',
};

export default function PrivacyPolicyPage() {
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
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 space-y-8">
            {/* Section 1 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 1 - WHAT DO WE DO WITH YOUR INFORMATION?</h2>
              <p className="text-gray-700 leading-relaxed">
                When you purchase something from our store, as part of the buying and selling process, we collect the personal 
                information you give us such as your name, address and email address. When you browse our store, we also automatically 
                receive your computer&apos;s internet protocol (IP) address in order to provide us with information that helps us learn 
                about your browser and operating system. Email marketing (if applicable): With your permission, we may send you emails 
                about our store, new products and other updates.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 2 - CONSENT</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">How do you get my consent?</h3>
                  <p className="text-gray-700 leading-relaxed">
                    When you provide us with personal information to complete a transaction, verify your credit card, place an order, 
                    arrange for a delivery or return a purchase, we imply that you consent to our collecting it and using it for that 
                    specific reason only. If we ask for your personal information for a secondary reason, like marketing, we will either 
                    ask you directly for your expressed consent, or provide you with an opportunity to say no.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">How do I withdraw my consent?</h3>
                  <p className="text-gray-700 leading-relaxed">
                    If after you opt-in, you change your mind, you may withdraw your consent for us to contact you, for the continued 
                    collection, use or disclosure of your information, at anytime, by contacting us at{' '}
                    <a href="mailto:lyraenterprisessales@gmail.com" className="text-blue-600 hover:underline">
                      lyraenterprisessales@gmail.com
                    </a>{' '}
                    or mailing us at: 10/21, Vasuki Street, Cholapuram, Ambattur, Chennai - 600053 (Near Municipal School)
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 3 - DISCLOSURE</h2>
              <p className="text-gray-700 leading-relaxed">
                We may disclose your personal information if we are required by law to do so or if you violate our Terms of Service.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 4 - PAYMENT</h2>
              <p className="text-gray-700 leading-relaxed">
                We use Razorpay for processing payments. We/Razorpay do not store your card data on their servers. The data is 
                encrypted through the Payment Card Industry Data Security Standard (PCI-DSS) when processing payment. Your purchase 
                transaction data is only used as long as is necessary to complete your purchase transaction. After that is complete, 
                your purchase transaction information is not saved. Our payment gateway adheres to the standards set by PCI-DSS as 
                managed by the PCI Security Standards Council, which is a joint effort of brands like Visa, MasterCard, American 
                Express and Discover. PCI-DSS requirements help ensure the secure handling of credit card information by our store 
                and its service providers. For more insight, you may also want to read terms and conditions of razorpay on{' '}
                <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  https://razorpay.com
                </a>
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 5 - THIRD-PARTY SERVICES</h2>
              <p className="text-gray-700 leading-relaxed">
                In general, the third-party providers used by us will only collect, use and disclose your information to the extent 
                necessary to allow them to perform the services they provide to us. However, certain third-party service providers, 
                such as payment gateways and other payment transaction processors, have their own privacy policies in respect to the 
                information we are required to provide to them for your purchase-related transactions.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 6 - SECURITY</h2>
              <p className="text-gray-700 leading-relaxed">
                To protect your personal information, we take reasonable precautions and follow industry best practices to make sure 
                it is not inappropriately lost, misused, accessed, disclosed, altered or destroyed.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 7 - COOKIES</h2>
              <p className="text-gray-700 leading-relaxed">
                We use cookies to maintain session of your user. It is not used to personally identify you on other websites.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 8 - AGE OF CONSENT</h2>
              <p className="text-gray-700 leading-relaxed">
                By using this site, you represent that you are at least the age of majority in your state or province of residence, 
                or that you are the age of majority in your state or province of residence and you have given us your consent to allow 
                any of your minor dependents to use this site.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">SECTION 9 - CHANGES TO THIS PRIVACY POLICY</h2>
              <p className="text-gray-700 leading-relaxed">
                We reserve the right to modify this privacy policy at any time, so please review it frequently. Changes and 
                clarifications will take effect immediately upon their posting on the website. If we make material changes to this 
                policy, we will notify you here that it has been updated.
              </p>
            </section>

            {/* Contact Information */}
            <section className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Questions and Contact Information</h2>
              <p className="text-gray-700 leading-relaxed">
                If you would like to access, correct, amend or delete any personal information we have about you, register a 
                complaint, or simply want more information contact our Privacy Compliance Officer at{' '}
                <a href="mailto:lyraenterprisessales@gmail.com" className="text-blue-600 hover:underline">
                  lyraenterprisessales@gmail.com
                </a>{' '}
                or by mail at 10/21, Vasuki Street, Cholapuram, Ambattur, Chennai - 600053 (Near Municipal School)
              </p>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
