'use client';

import { CheckCircle2, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function PaymentSuccessBanner() {
  const [show, setShow] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Auto-hide after 10 seconds
    const timer = setTimeout(() => {
      handleClose();
    }, 10000);

    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setShow(false);
    // Remove query parameter from URL
    router.replace('/admin/billing');
  };

  if (!show) return null;

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md">
      <div className="bg-green-50 border-2 border-green-200 rounded-lg shadow-lg p-4 mx-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-green-900 font-semibold mb-1">Payment Successful!</h3>
            <p className="text-green-700 text-sm">
              Your payment has been received and the invoice has been marked as paid. 
              Amount due is now ₹0.00.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="flex-shrink-0 text-green-600 hover:text-green-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
