import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Lyra Enterprises
            </h3>
            <p className="mt-4 text-sm text-gray-400">
              Empowering women's hygiene through innovative IoT-enabled vending solutions.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Quick Links</h4>
            <ul className="space-y-3">
              <li>
                <a href="#about" className="text-sm text-gray-400 hover:text-white transition-colors">
                  About Us
                </a>
              </li>
              <li>
                <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#contact" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Access</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Customer Login
                </Link>
              </li>
              <li>
                <Link href="/login?type=admin" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Admin Login
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Contact</h4>
            <ul className="space-y-3 text-sm text-gray-400">
              <li>Chennai - 600053</li>
              <li>
                <a href="tel:+918122378860" className="hover:text-white transition-colors">
                  +91 81223 78860
                </a>
              </li>
              <li>
                <a href="mailto:lyraenterprisessales@gmail.com" className="hover:text-white transition-colors break-all">
                  lyraenterprisessales@gmail.com
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-12 border-t border-gray-800 pt-8">
          <p className="text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} Lyra Enterprises. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
