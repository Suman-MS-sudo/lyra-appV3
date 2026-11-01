import { redirect } from 'next/navigation';

/** Coin statements are collected by Lyra, not paid online: old pay links open the statement. */
export default async function PaymentPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  redirect(`/customer/billing/${invoiceId}`);
}
