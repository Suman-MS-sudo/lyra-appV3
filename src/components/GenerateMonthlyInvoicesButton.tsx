'use client';

import { useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { generateMonthlyInvoices } from '@/app/actions/organization-billing';

export function GenerateMonthlyInvoicesButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!confirm('This will generate invoices for all organizations for the previous month. Continue?')) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const result = await generateMonthlyInvoices();
      
      if (result.success) {
        const successCount = result.results?.filter(r => r.success).length || 0;
        const totalCount = result.results?.length || 0;
        setMessage(`Successfully generated ${successCount} out of ${totalCount} invoices`);
        
        // Refresh page after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        Generate Monthly Invoices
      </button>
      
      {message && (
        <div className={`mt-2 text-sm ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
