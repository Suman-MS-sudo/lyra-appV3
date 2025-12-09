import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-12 lg:px-8">
        <div className="grid grid-cols-2 gap-4 sm:gap-8 lg:grid-cols-4">
          {/* Company Info - spans 2 cols on mobile */}
          <div className="col-span-2 lg:col-span-1">
            <h3 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2 sm:mb-4">
              Lyra Enterprises
            </h3>
            <p className="text-xs sm:text-sm text-gray-400 mb-2 sm:mb-4">
              IoT Vending Solutions - Smart Vending Reimagined
            </p>
            <div className="hidden sm:block mt-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                24/7 Online
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                Smart Insights
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-block w-2 h-2 bg-purple-500 rounded-full"></span>
                Multi-Modal
              </div>
            </div>
          </div>

          {/* Solutions */}
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-white mb-2 sm:mb-4">Solutions</h4>
            <ul className="space-y-1.5 sm:space-y-3">
              <li>
                <a href="#features" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Analytics
                </a>
              </li>
              <li>
                <a href="#contact" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Support
                </a>
              </li>
              <li>
                <Link href="/login" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Customer
                </Link>
              </li>
              <li>
                <Link href="/login?type=admin" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Admin
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs sm:text-sm font-semibold text-white mb-2 sm:mb-4">Quick Links</h4>
            <ul className="space-y-1.5 sm:space-y-3">
              <li>
                <a href="#about" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  About
                </a>
              </li>
              <li>
                <Link href="/privacy-policy" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms-of-service" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="text-xs sm:text-sm text-gray-400 hover:text-white transition-colors">
                  Refund
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Us - spans 2 cols on mobile */}
          <div className="col-span-2 lg:col-span-1">
            <h4 className="text-xs sm:text-sm font-semibold text-white mb-2 sm:mb-4">Contact Us</h4>
            <ul className="space-y-1.5 sm:space-y-3 text-xs sm:text-sm text-gray-400">
              <li className="text-xs leading-snug sm:leading-relaxed">
                10/21, Vasuki Street, Cholapuram,<br className="hidden sm:inline" /> Ambattur, Chennai - 600053
              </li>
              <li>
                <a href="tel:+918122378860" className="hover:text-white transition-colors">
                  +91 81223 78860
                </a>
              </li>
              <li>
                <a href="mailto:lyraenterprisessales@gmail.com" className="hover:text-white transition-colors break-all text-xs">
                  lyraenterprisessales@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-6 sm:mt-12 border-t border-gray-800 pt-4 sm:pt-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
            <p className="text-xs sm:text-sm text-gray-400 text-center sm:text-left">
              © {new Date().getFullYear()} Lyra Enterprises
            </p>
            <div className="flex items-center gap-4 sm:gap-6 text-xs text-gray-500">
              <Link href="/privacy-policy" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="/terms-of-service" className="hover:text-white transition-colors">
                Terms
              </Link>
              <Link href="/refund-policy" className="hover:text-white transition-colors">
                Refund
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
