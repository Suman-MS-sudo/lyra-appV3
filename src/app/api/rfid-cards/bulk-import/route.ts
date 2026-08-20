import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const MAX_ROWS = 2000;

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
  }

  return { service };
}

type ImportRow = Record<string, string | number | undefined>;

// Column headers are matched case-insensitively with whitespace trimmed, and
// each logical field accepts several real-world spreadsheet spellings (e.g.
// an employee roster's "tag no" / "name" columns) on top of this importer's
// own uid/holder_name template — so a sheet doesn't need to be reformatted
// to match our exact column names before uploading. Columns with no mapped
// alias (an employee code, department, date-of-joined, etc.) are simply
// ignored rather than causing an error.
const FIELD_ALIASES: Record<string, string[]> = {
  uid: ['uid', 'tag no', 'tag_no', 'tagno', 'tag not', 'card uid', 'card_uid'],
  holder_name: ['holder_name', 'name', 'holder name', 'employee name'],
  card_type: ['card_type', 'type'],
  initial_credits: ['initial_credits', 'credits'],
  organization: ['organization', 'org'],
  machine: ['machine'],
  product: ['product'],
};

function normalizeRow(raw: ImportRow): Record<string, string> {
  const byLowerKey: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    byLowerKey[k.trim().toLowerCase()] = v === undefined || v === null ? '' : String(v).trim();
  }
  const out: Record<string, string> = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (byLowerKey[alias]) { out[field] = byLowerKey[alias]; break; }
    }
  }
  return out;
}

// Real-world UID columns show up formatted like a MAC address
// ("aa:bb:CC;DD") rather than the bare hex this app stores — strip
// everything but hex digits before uppercasing.
function cleanUid(raw: string): string {
  return raw.replace(/[^0-9a-fA-F]/g, '').toUpperCase();
}

type RowResult = {
  row: number;
  uid: string;
  status: 'created' | 'error';
  error?: string;
};

function resolveByName(
  list: { id: string; name: string; customer_id?: string | null }[],
  name: string | undefined,
  label: string,
  scopeFilter?: (item: { id: string; name: string; customer_id?: string | null }) => boolean
): { id: string | null; error?: string } {
  const trimmed = (name || '').trim();
  if (!trimmed) return { id: null };
  const candidates = list.filter(item =>
    item.name.toLowerCase() === trimmed.toLowerCase() && (!scopeFilter || scopeFilter(item))
  );
  if (candidates.length === 0) return { id: null, error: `${label} not found: "${trimmed}"` };
  if (candidates.length > 1) {
    return { id: null, error: `${label} name "${trimmed}" matches ${candidates.length} records — rename it uniquely or add this card individually` };
  }
  return { id: candidates[0].id };
}

/**
 * POST /api/rfid-cards/bulk-import
 * Body: { rows: ImportRow[] } — parsed client-side from an uploaded CSV.
 *
 * Reuses the exact same field defaulting/validation as POST /api/rfid-cards
 * (single-card create), but batches organization/machine/product name
 * resolution and the actual insert into a handful of round trips instead of
 * one per row — the offline-sync route (POST /api/rfid-payment/offline-sync)
 * hit exactly this scaling problem doing per-row DB calls, so this is built
 * batched from the start. Duplicate UIDs (against existing cards, or
 * within the uploaded file itself) are reported per-row rather than
 * aborting the whole import.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? (body.rows as ImportRow[]) : null;

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: 'No rows to import' }, { status: 400 });
  }
  if (rows.length > MAX_ROWS) {
    return NextResponse.json({ error: `Too many rows in one import (max ${MAX_ROWS})` }, { status: 400 });
  }

  const [{ data: organizations }, { data: machines }, { data: products }] = await Promise.all([
    auth.service!.from('organizations').select('id, name'),
    auth.service!.from('vending_machines').select('id, name, customer_id'),
    auth.service!.from('products').select('id, name').eq('is_active', true),
  ]);

  const results: RowResult[] = [];
  const pendingByUid = new Map<string, Record<string, any>>();
  const seenUids = new Set<string>();
  // uid -> 1-based row number, so the post-insert lookups below don't need
  // to re-guess which raw column held the uid.
  const rowNumByUid = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const norm = normalizeRow(rows[i]);
    const rowNum = i + 1;
    const uid = cleanUid(norm.uid || '');

    if (!uid) {
      results.push({ row: rowNum, uid: '', status: 'error', error: 'Missing uid' });
      continue;
    }
    if (seenUids.has(uid)) {
      results.push({ row: rowNum, uid, status: 'error', error: 'Duplicate uid within this file' });
      continue;
    }
    seenUids.add(uid);
    rowNumByUid.set(uid, rowNum);

    const orgResult = resolveByName(organizations || [], norm.organization, 'Organization');
    if (orgResult.error) {
      results.push({ row: rowNum, uid, status: 'error', error: orgResult.error });
      continue;
    }

    const machineResult = resolveByName(
      machines || [],
      norm.machine,
      'Machine',
      orgResult.id ? (m) => m.customer_id === orgResult.id : undefined
    );
    if (machineResult.error) {
      results.push({ row: rowNum, uid, status: 'error', error: machineResult.error });
      continue;
    }

    const productResult = resolveByName(products || [], norm.product, 'Product');
    if (productResult.error) {
      results.push({ row: rowNum, uid, status: 'error', error: productResult.error });
      continue;
    }

    const resolvedType = norm.card_type === 'postpaid' ? 'postpaid' : 'prepaid';
    const initialCredits = parseInt(norm.initial_credits || '0', 10);

    pendingByUid.set(uid, {
      uid,
      holder_name: norm.holder_name || null,
      organization_id: orgResult.id,
      machine_id: machineResult.id,
      product_id: productResult.id,
      card_type: resolvedType,
      // Postpaid cards don't use credits — always store 0 regardless of what was passed.
      credits_remaining: resolvedType === 'postpaid' ? 0 : Math.max(0, Math.round(initialCredits || 0)),
    });
  }

  if (pendingByUid.size > 0) {
    const { data: inserted, error: insertError } = await auth.service!
      .from('rfid_cards')
      .upsert(Array.from(pendingByUid.values()), { onConflict: 'uid', ignoreDuplicates: true })
      .select('uid');

    if (insertError) {
      for (const uid of pendingByUid.keys()) {
        results.push({ row: rowNumByUid.get(uid) ?? 0, uid, status: 'error', error: insertError.message });
      }
    } else {
      const newlyInserted = new Set((inserted ?? []).map((r: any) => r.uid));
      for (const uid of pendingByUid.keys()) {
        const rowNum = rowNumByUid.get(uid) ?? 0;
        if (newlyInserted.has(uid)) {
          results.push({ row: rowNum, uid, status: 'created' });
        } else {
          results.push({ row: rowNum, uid, status: 'error', error: 'A card with this UID already exists' });
        }
      }
    }
  }

  results.sort((a, b) => a.row - b.row);
  const created = results.filter(r => r.status === 'created').length;

  return NextResponse.json({
    results,
    summary: { total: rows.length, created, failed: rows.length - created },
  });
}
