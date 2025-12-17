'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface PaymentFormProps {
  invoiceId: string;
  amount: number;
  organizationName: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

export default function PaymentForm({
  invoiceId,
  amount,
  organizationName,
  invoiceNumber,
  customerName,
  customerEmail,
  customerPhone,
}: PaymentFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handlePayment = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create Razorpay order
      const orderResponse = await fetch('/api/billing/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId,
          amount,
        }),
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order');
      }

      const orderData = await orderResponse.json();

      // Load Razorpay script
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      document.body.appendChild(script);

      script.onload = () => {
        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: amount,
          currency: 'INR',
          name: 'Lyra Enterprises',
          description: `Payment for Invoice ${invoiceNumber}`,
          order_id: orderData.orderId,
          prefill: {
            name: customerName,
            email: customerEmail,
            contact: customerPhone,
          },
          notes: {
            invoice_id: invoiceId,
            invoice_number: invoiceNumber,
            organization: organizationName,
          },
          theme: {
            color: '#2563eb',
          },
          handler: async function (response: any) {
            try {
              // Verify payment
              const verifyResponse = await fetch('/api/billing/verify-payment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  invoiceId,
                }),
              });

              if (!verifyResponse.ok) {
                throw new Error('Payment verification failed');
              }

              // Success - redirect to invoice page
              router.push(`/customer/billing/${invoiceId}?payment=success`);
            } catch (err) {
              setError('Payment verification failed. Please contact support.');
              setLoading(false);
            }
          },
          modal: {
            ondismiss: function () {
              setLoading(false);
            },
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.open();
      };

      script.onerror = () => {
        setError('Failed to load payment gateway');
        setLoading(false);
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={handlePayment}
        disabled={loading}
        className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing...
          </>
        ) : (
          <>Pay ₹{(amount / 100).toFixed(2)} with Razorpay</>
        )}
      </button>

      <p className="text-xs text-gray-500 text-center mt-4">
        Powered by Razorpay • Secure Payment Gateway
      </p>
    </div>
  );
}
