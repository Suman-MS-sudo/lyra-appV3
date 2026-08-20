// Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped quotes (""), and both \n and \r\n line endings. No streaming —
// fine for the admin bulk-upload sizes this app deals with (hundreds to a
// few thousand rows), not meant for huge files.
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      pushField();
    } else if (c === '\n') {
      pushRow();
    } else if (c === '\r') {
      // swallow; \r\n handled by the following \n, bare \r treated as a line end too
      if (text[i + 1] !== '\n') pushRow();
    } else {
      field += c;
    }
  }
  // trailing field/row (file may or may not end with a newline)
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmptyRows = rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
  if (nonEmptyRows.length === 0) return { headers: [], rows: [] };

  const headers = nonEmptyRows[0].map(h => h.trim());
  const dataRows = nonEmptyRows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });

  return { headers, rows: dataRows };
}

export function toCsvBlob(headerRow: string[], dataRows: string[][]): Blob {
  const escapeField = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headerRow, ...dataRows].map(r => r.map(escapeField).join(','));
  return new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
}
