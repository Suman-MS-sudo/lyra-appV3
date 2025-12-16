'use client';

import { useState } from 'react';
import { Send, Loader2, Check } from 'lucide-react';
import { sendInvoiceEmail } from '@/app/actions/organization-billing';

interface SendInvoiceEmailButtonProps {
  invoiceId: string;
}

export function SendInvoiceEmailButton({ invoiceId }: SendInvoiceEmailButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSend = async () => {
    if (!confirm('Send invoice email to organization?')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await sendInvoiceEmail({ invoiceId });
      
      if (result.success) {
        setSent(true);
        setMessage({ 
          type: 'success', 
          text: result.message || 'Invoice email sent successfully!' 
        });
        setTimeout(() => {
          setSent(false);
          setMessage(null);
        }, 5000);
      } else {
        setMessage({ type: 'error', text: 'Failed to send email' });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Failed to send email' 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleSend}
        disabled={loading || sent}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
          sent 
            ? 'bg-green-600 text-white' 
            : 'bg-blue-600 text-white hover:bg-blue-700'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
        title="Send Invoice Email"
      >
        {loading ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Sending...
          </>
        ) : sent ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Sent
          </>
        ) : (
          <>
            <Send className="h-3.5 w-3.5" />
            Email
          </>
        )}
      </button>
    </>
  );
}
