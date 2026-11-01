import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Machine ownership model: `vending_machines.customer_id` is the organization's
 * UUID, but assigning a machine to a person (super customer → Users → assign)
 * moves `customer_id` to that person's profile id. So "the company's machines"
 * are those owned by the org OR by any member of it.
 */

interface ProfileLike {
  account_type?: string | null;
  organization_id?: string | null;
}

/**
 * The `customer_id` values whose machines this user may see.
 * Super customers: their organization + every member of it (assigned machines stay visible).
 * Everyone else: only machines assigned to them.
 */
export async function visibleOwnerIds(db: SupabaseClient, userId: string, profile: ProfileLike | null | undefined): Promise<string[]> {
  if (profile?.account_type !== 'super_customer' || !profile.organization_id) return [userId];
  const { data: members } = await db.from('profiles').select('id').eq('organization_id', profile.organization_id);
  return Array.from(new Set([profile.organization_id, userId, ...(members || []).map((m: { id: string }) => m.id)]));
}

/**
 * The organization a machine belongs to, following an assignment to a person
 * back to that person's organization. Falls back to `customer_id` itself
 * (previous behaviour) when it is neither an org nor an org member.
 */
export async function machineOrganizationId(db: SupabaseClient, customerId: string | null | undefined): Promise<string | null> {
  if (!customerId) return null;
  const { data: org } = await db.from('organizations').select('id').eq('id', customerId).maybeSingle();
  if (org) return org.id as string;
  const { data: person } = await db.from('profiles').select('organization_id').eq('id', customerId).maybeSingle();
  return (person?.organization_id as string | null) ?? customerId;
}
