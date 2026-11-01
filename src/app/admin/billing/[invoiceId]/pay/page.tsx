import { redirect } from 'next/navigation';

/** Coin statements are collected in cash by Lyra, not paid online: open the statement instead. */
export default async function AdminPayPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  redirect(`/admin/billing/${invoiceId}`);
}
