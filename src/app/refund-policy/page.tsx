import Link from 'next/link';
import { Footer } from '@/components/landing/footer';

export const metadata = {
  title: 'Cancellation/Refund Policy - Lyra Enterprises',
  description: 'Cancellation and Refund Policy for Lyra Enterprises IoT Vending Solutions',
};

export default function RefundPolicyPage() {
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
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">Cancellation/Refund Policy</h1>
          
          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 space-y-8">
            {/* Returns */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Returns</h2>
              <div className="space-y-4 text-gray-700 leading-relaxed">
                <p>
                  Our policy lasts 30 days. If 30 days have gone by since your purchase, unfortunately we can&apos;t offer 
                  you a refund or exchange. To be eligible for a return, your item must be unused and in the same condition 
                  that you received it. It must also be in the original packaging.
                </p>
                <p>
                  Several types of goods are exempt from being returned. Perishable goods such as food, flowers, newspapers 
                  or magazines cannot be returned. We also do not accept products that are intimate or sanitary goods, 
                  hazardous materials, or flammable liquids or gases.
                </p>
              </div>
            </section>

            {/* Non-returnable items */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Additional non-returnable items:</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Gift cards</li>
                <li>Downloadable software products</li>
                <li>Some health and personal care items</li>
              </ul>
            </section>

            {/* Partial refunds */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Partial refunds may be granted for:</h2>
              <ul className="list-disc list-inside space-y-2 text-gray-700 ml-4">
                <li>Books with obvious signs of use</li>
                <li>CD, DVD, VHS tape, software, video game, cassette tape, or vinyl record that has been opened</li>
                <li>Any item not in its original condition, is damaged or missing parts for reasons not due to our error</li>
                <li>Any item that is returned more than 30 days after delivery</li>
              </ul>
            </section>

            {/* Refunds */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Refunds</h2>
              <p className="text-gray-700 leading-relaxed">
                Once your return is received and inspected, we will send you an email to notify you that we have received 
                your returned item. We will also notify you of the approval or rejection of your refund. If you are approved, 
                then your refund will be processed, and a credit will automatically be applied to your credit card or original 
                method of payment, within a certain amount of days.
              </p>
            </section>

            {/* Late or missing refunds */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Late or missing refunds</h2>
              <p className="text-gray-700 leading-relaxed">
                If you haven&apos;t received a refund yet, first check your bank account again. Then contact your credit card 
                company, it may take some time before your refund is officially posted. Next contact your bank. There is often 
                some processing time before a refund is posted. If you&apos;ve done all of this and you still have not received 
                your refund yet, please contact us at{' '}
                <a href="mailto:lyraenterprisessales@gmail.com" className="text-blue-600 hover:underline">
                  lyraenterprisessales@gmail.com
                </a>
                .
              </p>
            </section>

            {/* Exchanges */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Exchanges</h2>
              <p className="text-gray-700 leading-relaxed">
                We only replace items if they are defective or damaged. If you need to exchange it for the same item, send 
                us an email at{' '}
                <a href="mailto:lyraenterprisessales@gmail.com" className="text-blue-600 hover:underline">
                  lyraenterprisessales@gmail.com
                </a>{' '}
                and send your item to: 622 Manglam Electronic Market Jaipur Rajasthan India 302001.
              </p>
            </section>

            {/* Shipping */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Shipping</h2>
              <p className="text-gray-700 leading-relaxed">
                To return your product, you should mail your product to: 622 Manglam Electronic Market Jaipur Rajasthan India 
                302001. You will be responsible for paying for your own shipping costs for returning your item. Shipping costs 
                are non-refundable.
              </p>
            </section>

            {/* Questions */}
            <section className="bg-blue-50 p-6 rounded-lg">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Questions?</h2>
              <p className="text-gray-700 leading-relaxed">
                For any questions about returns or refunds, contact us at{' '}
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
