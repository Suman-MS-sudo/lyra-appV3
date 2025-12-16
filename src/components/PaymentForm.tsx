'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface PaymentFormProps {
  invoiceId: string;
  amount: number;
  invoiceNumber: string;
  organizationName: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PaymentForm({ 
  invoiceId, 
  amount, 
  invoiceNumber,
  organizationName 
}: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Load Razorpay script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handlePayment = async () => {
    setLoading(true);
    setError(null);

    try {
      // Create Razorpay order
      const orderResponse = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      });

      if (!orderResponse.ok) {
        const errorData = await orderResponse.json();
        throw new Error(errorData.error || 'Failed to create order');
      }

      const orderData = await orderResponse.json();

      // Initialize Razorpay payment
      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Lyra',
        description: `Payment for Invoice ${orderData.invoiceNumber}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify payment on backend
            const verifyResponse = await fetch('/api/billing/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyResponse.ok) {
              // Payment successful - redirect to billing page
              router.push('/admin/billing?payment=success');
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (err: any) {
            setError(err.message || 'Payment verification failed');
            setLoading(false);
          }
        },
        prefill: {
          name: organizationName,
        },
        theme: {
          color: '#3B82F6',
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      const rzp = new window.Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
        setError(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });

      rzp.open();
    } catch (err: any) {
      setError(err.message || 'Failed to initiate payment');
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
      >
        {loading ? 'Processing...' : `Pay ₹${(amount / 100).toFixed(2)}`}
      </button>

      <div className="text-center text-sm text-gray-500">
        <p>Secure payment powered by Razorpay</p>
        <p className="mt-1">UPI • Cards • Net Banking • Wallets</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold mb-2">Payment Instructions:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Click "Pay" button above to open payment gateway</li>
          <li>Choose your preferred payment method (UPI, Card, etc.)</li>
          <li>Complete the payment</li>
          <li>Payment status will be updated automatically</li>
          <li>You will be redirected back after successful payment</li>
        </ul>
      </div>
    </div>
  );
}
