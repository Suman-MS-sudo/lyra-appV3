'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';

export default function DeleteUserButton({ userId, userEmail }: { userId: string; userEmail: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete user "${userEmail}"? This permanently removes their account and cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Failed to delete user');
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="p-2 rounded-lg inline-flex transition-colors hover:bg-white/10 disabled:opacity-40"
      title="Delete user"
      style={{ color: '#F87171' }}
    >
      {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
