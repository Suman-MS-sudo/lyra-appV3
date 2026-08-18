import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage, type RGB } from 'pdf-lib';

interface ReportRow {
  date: string;
  type: 'Online' | 'Coin' | 'RFID';
  machine: string;
  location: string;
  amount: number;
}

interface MachineSummaryRow {
  name: string;
  location: string;
  count: number;
  amount: number;
}

interface UserSummaryRow {
  holderName: string;
  cardUid: string;
  taps: number;
  amount: number;
  machines: Set<string>;
  lastTap: string;
}

interface PaymentSplitEntry {
  amount: number;
  count: number;
}

interface TrendBucket {
  label: string;
  value: number;
}

// Lyra wordmark icon, inlined as base64 so PDF generation never depends on
// filesystem access to public/logo.png at request time — serverless deploys
// commonly don't trace/include static assets into the function bundle.
const LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAKuSURBVHhe7dOxaR0ADEVR75XtvEVWSJM1PJEhTX7KwMdcm8CDII7gNAKBmvvy7fX9AXzs5XkB/CUQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSCQiV+Pt8fn8/bz+Y7/jUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCYEcoVAJgRyhUAmBHKFQCa+Fshufj9+fH/+iX8hkAmBXCGQCYFcIZAJgVwhkAmBXCGQCYFcIZAJgVwhkAmBXCEQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKBIBAIAoEgEAgCgSAQCAKB8AfLK1ahqDZkqAAAAABJRU5ErkJggg==';

// ── Brand palette (mirrors the dashboard's rose/purple theme) ──
const BRAND_PURPLE = rgb(0.486, 0.227, 0.929); // #7C3AED
const BRAND_ROSE = rgb(0.957, 0.247, 0.369); // #F43F5E
const BRAND_PINK = rgb(0.925, 0.286, 0.600); // #EC4899
const ACCENT_BLUE = rgb(0.376, 0.647, 0.980); // #60A5FA
const ACCENT_GREEN = rgb(0.204, 0.827, 0.600); // #34D399
const ACCENT_AMBER = rgb(0.984, 0.749, 0.141); // #FBBF24
const TEXT_DARK = rgb(0.11, 0.11, 0.14);
const TEXT_MUTED = rgb(0.45, 0.45, 0.50);
const LIGHT_TINT = rgb(0.965, 0.953, 0.996);
const BORDER_LIGHT = rgb(0.90, 0.90, 0.93);

const PAGE_WIDTH = 841.89; // A4 landscape
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;
const HEADER_BAND_HEIGHT = 62;
const FOOTER_BAND_HEIGHT = 34;
const CONTENT_TOP = PAGE_HEIGHT - HEADER_BAND_HEIGHT - 26;
const CONTENT_BOTTOM = FOOTER_BAND_HEIGHT + 18;
const TABLE_ROW_HEIGHT = 16;
const TABLE_HEADER_HEIGHT = 20;

// Same customer/machine scoping as the customer dashboard page itself:
// super_customers see every machine in their org, regular customers see
// only machines assigned directly to them. Admins get every machine
// platform-wide since they aren't tied to a single organization.
async function requireCustomerAndMachines() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const service = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await service
    .from('profiles')
    .select('id, role, account_type, organization_id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return { error: NextResponse.json({ error: 'Access required' }, { status: 403 }) };
  }

  if (profile.role === 'admin') {
    const { data: machines } = await service.from('vending_machines').select('id');
    return { service, profile, machines: machines || [] };
  }

  const isSuperCustomer = profile.account_type === 'super_customer';

  const { data: machines } = await service
    .from('vending_machines')
    .select('id')
    .eq('customer_id', isSuperCustomer ? profile.organization_id : user.id);

  return { service, profile, machines: machines || [] };
}

// Buckets transaction rows into up to ~24 time slices across the requested
// range so the revenue trend chart stays readable whether the range is a
// week or 90 days.
function buildRevenueTrend(rows: ReportRow[], start: Date, end: Date): TrendBucket[] {
  const msPerDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / msPerDay) + 1);
  const maxBuckets = 24;
  const bucketDays = Math.max(1, Math.ceil(totalDays / maxBuckets));

  const buckets: { start: number; end: number; value: number }[] = [];
  let cursor = start.getTime();
  while (cursor <= end.getTime()) {
    const bucketEnd = Math.min(cursor + bucketDays * msPerDay - 1, end.getTime());
    buckets.push({ start: cursor, end: bucketEnd, value: 0 });
    cursor = bucketEnd + 1;
  }

  for (const row of rows) {
    const t = new Date(row.date).getTime();
    for (const b of buckets) {
      if (t >= b.start && t <= b.end) {
        b.value += row.amount;
        break;
      }
    }
  }

  return buckets.map((b) => ({
    label: new Date(b.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    value: Math.round(b.value * 100) / 100,
  }));
}

function escapeCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvLine(fields: (string | number)[]): string {
  return fields.map((v) => escapeCsvField(String(v))).join(',');
}

function toCsv(
  totalRevenue: number,
  totalTransactions: number,
  userSummary: UserSummaryRow[],
  machineSummary: MachineSummaryRow[],
  startLabel: string,
  endLabel: string
): string {
  const lines: string[] = [];

  lines.push('Lyra Vending - Customer Usage Report');
  lines.push(csvLine(['Period', `${startLabel} - ${endLabel}`]));
  lines.push(csvLine(['Total Revenue (INR)', totalRevenue.toFixed(2)]));
  lines.push(csvLine(['Total Transactions', totalTransactions]));
  lines.push(csvLine(['Unique RFID Users', userSummary.length]));
  lines.push(csvLine(['Machines Used', machineSummary.length]));
  lines.push('');

  lines.push('MACHINE USAGE SUMMARY (most consumed first)');
  lines.push(csvLine(['Machine', 'Location', 'Transactions', 'Revenue (INR)', '% of Total Revenue']));
  for (const m of [...machineSummary].sort((a, b) => b.count - a.count)) {
    lines.push(csvLine([
      m.name,
      m.location,
      m.count,
      m.amount.toFixed(2),
      totalRevenue > 0 ? `${((m.amount / totalRevenue) * 100).toFixed(1)}%` : '0%',
    ]));
  }
  lines.push('');

  lines.push('USER / RFID CARD USAGE SUMMARY (most active first)');
  lines.push(csvLine(['Holder Name', 'Card UID', 'Taps', 'Total Spent (INR)', 'Machines Used', 'Last Tap']));
  for (const u of [...userSummary].sort((a, b) => b.taps - a.taps)) {
    lines.push(csvLine([
      u.holderName,
      u.cardUid,
      u.taps,
      u.amount.toFixed(2),
      Array.from(u.machines).join('; '),
      new Date(u.lastTap).toLocaleString('en-IN'),
    ]));
  }

  return lines.join('\n');
}

function fitText(text: string, f: PDFFont, size: number, maxWidth: number): string {
  if (f.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && f.widthOfTextAtSize(t + '…', size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

// Ascent/descent of a font at a given size, derived from pdf-lib's real
// glyph metrics rather than guessed — used to optically center text instead
// of relying on hand-picked baseline offsets that drift apart whenever a
// font size changes.
function fontVerticalMetrics(f: PDFFont, size: number): { ascent: number; descent: number } {
  const full = f.heightAtSize(size, { descender: true });
  const ascent = f.heightAtSize(size, { descender: false });
  return { ascent, descent: full - ascent };
}

function drawBrandHeader(page: PDFPage, boldFont: PDFFont, font: PDFFont, logoImage: PDFImage | null, sectionTitle: string) {
  const bandBottom = PAGE_HEIGHT - HEADER_BAND_HEIGHT;
  const bandCenter = bandBottom + HEADER_BAND_HEIGHT / 2;

  page.drawRectangle({ x: 0, y: bandBottom, width: PAGE_WIDTH, height: HEADER_BAND_HEIGHT, color: BRAND_PURPLE });
  page.drawRectangle({ x: 0, y: bandBottom - 3, width: PAGE_WIDTH, height: 3, color: BRAND_ROSE });

  let textX = MARGIN;
  if (logoImage) {
    const logoSize = 32;
    page.drawImage(logoImage, { x: MARGIN, y: bandCenter - logoSize / 2, width: logoSize, height: logoSize });
    textX = MARGIN + logoSize + 12;
  }

  // Two-line "LYRA / Vending Machine Network" lockup, centered as a block
  // on the band's vertical center (same reference line the title below
  // uses), with a fixed gap between the two baselines.
  const nameSize = 16;
  const subSize = 8;
  const lineGap = 14;
  const nameMetrics = fontVerticalMetrics(boldFont, nameSize);
  const subMetrics = fontVerticalMetrics(font, subSize);
  const nameY = bandCenter + (nameMetrics.ascent - lineGap - subMetrics.descent) / 2;
  const subY = nameY - lineGap;
  page.drawText('LYRA', { x: textX, y: nameY, size: nameSize, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText('Vending Machine Network', { x: textX, y: subY, size: subSize, font, color: rgb(0.90, 0.86, 0.98) });

  const titleSize = 13;
  const titleMetrics = fontVerticalMetrics(boldFont, titleSize);
  const titleY = bandCenter - (titleMetrics.ascent - titleMetrics.descent) / 2;
  const titleWidth = boldFont.widthOfTextAtSize(sectionTitle, titleSize);
  page.drawText(sectionTitle, { x: PAGE_WIDTH - MARGIN - titleWidth, y: titleY, size: titleSize, font: boldFont, color: rgb(1, 1, 1) });
}

function drawFooter(page: PDFPage, font: PDFFont, pageNum: number, totalPages: number, generatedAt: string) {
  page.drawLine({ start: { x: MARGIN, y: FOOTER_BAND_HEIGHT }, end: { x: PAGE_WIDTH - MARGIN, y: FOOTER_BAND_HEIGHT }, thickness: 0.5, color: BORDER_LIGHT });
  page.drawText('Lyra Vending — Confidential usage report', { x: MARGIN, y: FOOTER_BAND_HEIGHT - 14, size: 7.5, font, color: TEXT_MUTED });

  const genText = `Generated ${generatedAt}`;
  const genWidth = font.widthOfTextAtSize(genText, 7.5);
  page.drawText(genText, { x: (PAGE_WIDTH - genWidth) / 2, y: FOOTER_BAND_HEIGHT - 14, size: 7.5, font, color: TEXT_MUTED });

  const pageText = `Page ${pageNum} of ${totalPages}`;
  const pageWidth = font.widthOfTextAtSize(pageText, 7.5);
  page.drawText(pageText, { x: PAGE_WIDTH - MARGIN - pageWidth, y: FOOTER_BAND_HEIGHT - 14, size: 7.5, font, color: TEXT_MUTED });
}

function drawStatCard(page: PDFPage, font: PDFFont, boldFont: PDFFont, x: number, yTop: number, w: number, h: number, label: string, value: string, accent: RGB) {
  page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: LIGHT_TINT, borderColor: BORDER_LIGHT, borderWidth: 0.75 });
  page.drawRectangle({ x, y: yTop - h, width: 4, height: h, color: accent });
  page.drawText(label.toUpperCase(), { x: x + 16, y: yTop - 20, size: 8, font: boldFont, color: TEXT_MUTED });
  page.drawText(fitText(value, boldFont, 17, w - 30), { x: x + 16, y: yTop - h + 16, size: 17, font: boldFont, color: TEXT_DARK });
}

// A 100%-stacked bar showing revenue share by payment method, with a legend
// row underneath giving the exact amount and percentage per method.
function drawStackedBar(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  x: number,
  yTop: number,
  width: number,
  segments: { label: string; amount: number; count: number; color: RGB }[]
): number {
  const barHeight = 22;
  const total = segments.reduce((s, seg) => s + seg.amount, 0) || 1;
  const y = yTop - barHeight;

  page.drawRectangle({ x, y, width, height: barHeight, color: rgb(0.94, 0.94, 0.96) });
  let curX = x;
  for (const seg of segments) {
    const segWidth = (seg.amount / total) * width;
    if (segWidth > 0.5) {
      page.drawRectangle({ x: curX, y, width: segWidth, height: barHeight, color: seg.color });
    }
    curX += segWidth;
  }

  let legendY = y - 20;
  const legendGap = width / segments.length;
  segments.forEach((seg, i) => {
    const lx = x + i * legendGap;
    page.drawRectangle({ x: lx, y: legendY - 8, width: 9, height: 9, color: seg.color });
    page.drawText(seg.label, { x: lx + 14, y: legendY - 2, size: 9, font: boldFont, color: TEXT_DARK });
    page.drawText(
      `Rs. ${seg.amount.toFixed(0)}  (${((seg.amount / total) * 100).toFixed(0)}%)  •  ${seg.count} txns`,
      { x: lx + 14, y: legendY - 13, size: 8, font, color: TEXT_MUTED }
    );
  });

  return legendY - 30;
}

// Vertical bar chart used for the revenue trend across the reporting period.
function drawVerticalBarChart(
  page: PDFPage,
  font: PDFFont,
  x: number,
  yTop: number,
  width: number,
  height: number,
  items: TrendBucket[],
  barColor: RGB
): number {
  const baseline = yTop - height;
  page.drawLine({ start: { x, y: baseline }, end: { x: x + width, y: baseline }, thickness: 0.75, color: BORDER_LIGHT });

  if (items.length === 0) {
    page.drawText('No activity in this period.', { x, y: baseline + height / 2, size: 9.5, font, color: TEXT_MUTED });
    return baseline - 16;
  }

  const maxValue = Math.max(...items.map((i) => i.value), 1);
  const barGap = 4;
  const barWidth = Math.max((width - barGap * (items.length - 1)) / items.length, 1);
  const labelEvery = Math.max(1, Math.ceil(items.length / 10));

  items.forEach((item, i) => {
    const bh = item.value > 0 ? Math.max((item.value / maxValue) * (height - 12), 2) : 0;
    const bx = x + i * (barWidth + barGap);
    page.drawRectangle({ x: bx, y: baseline, width: barWidth, height: bh, color: barColor });
    if (i % labelEvery === 0) {
      page.drawText(fitText(item.label, font, 6.5, barWidth + barGap + 6), { x: bx, y: baseline - 10, size: 6.5, font, color: TEXT_MUTED });
    }
  });

  return baseline - 24;
}

// Horizontal ranked bar chart used for "Most Used Machines" / "Top RFID Users".
function drawRankedBarChart(
  page: PDFPage,
  font: PDFFont,
  boldFont: PDFFont,
  x: number,
  yStart: number,
  width: number,
  title: string,
  items: { label: string; value: number; sublabel: string }[],
  barColor: RGB
): number {
  let y = yStart;
  page.drawText(title, { x, y, size: 12.5, font: boldFont, color: TEXT_DARK });
  y -= 22;

  if (items.length === 0) {
    page.drawText('No activity in this period.', { x, y, size: 9.5, font, color: TEXT_MUTED });
    return y - 16;
  }

  const labelWidth = 170;
  const valueWidth = 120;
  const barHeight = 15;
  const barGap = 9;
  const barMaxWidth = width - labelWidth - valueWidth;
  const maxValue = Math.max(...items.map((i) => i.value), 1);

  items.forEach((item, i) => {
    const label = fitText(`${i + 1}. ${item.label}`, font, 9, labelWidth - 6);
    page.drawText(label, { x, y: y - 11, size: 9, font, color: rgb(0.15, 0.15, 0.18) });

    const barWidth = Math.max((item.value / maxValue) * barMaxWidth, 2);
    page.drawRectangle({ x: x + labelWidth, y: y - barHeight + 2, width: barMaxWidth, height: barHeight, color: rgb(0.94, 0.94, 0.96) });
    page.drawRectangle({ x: x + labelWidth, y: y - barHeight + 2, width: barWidth, height: barHeight, color: barColor });

    page.drawText(`${item.value}  (${item.sublabel})`, { x: x + labelWidth + barMaxWidth + 8, y: y - 11, size: 9, font, color: TEXT_DARK });
    y -= barHeight + barGap;
  });

  return y - 8;
}

// Draws a table with a branded header row, alternating row stripes, and
// automatic page breaks (each continuation page gets its own brand header).
function drawTable(
  font: PDFFont,
  boldFont: PDFFont,
  headers: string[],
  colWidths: number[],
  rows: string[][],
  emptyMessage: string,
  firstPage: PDFPage,
  startY: number,
  addBrandedPage: (title: string) => PDFPage,
  continuationTitle: string
) {
  const colX = colWidths.reduce<number[]>((acc, _w, i) => {
    acc.push(i === 0 ? MARGIN : acc[i - 1] + colWidths[i - 1]);
    return acc;
  }, []);
  const tableWidth = colX[colX.length - 1] + colWidths[colWidths.length - 1] - MARGIN;

  // `yy` is always the TOP of the band about to be drawn; every rectangle is
  // drawn strictly downward from it (never upward past it), so the header
  // band and the first row's stripe can never paint over each other.
  function drawHeaderRow(p: PDFPage, yy: number): number {
    const bandBottom = yy - TABLE_HEADER_HEIGHT;
    p.drawRectangle({ x: MARGIN, y: bandBottom, width: tableWidth, height: TABLE_HEADER_HEIGHT, color: BRAND_PURPLE });
    const baseline = bandBottom + (TABLE_HEADER_HEIGHT - 9) / 2 + 2;
    headers.forEach((h, i) => p.drawText(h, { x: colX[i] + 6, y: baseline, size: 9, font: boldFont, color: rgb(1, 1, 1) }));
    return bandBottom - 4; // small gap before the first data row
  }

  let curPage = firstPage;
  let curY = drawHeaderRow(curPage, startY);

  if (rows.length === 0) {
    curPage.drawText(emptyMessage, { x: MARGIN, y: curY - 10, size: 10, font, color: TEXT_MUTED });
    curY -= TABLE_ROW_HEIGHT;
  }

  rows.forEach((cells, idx) => {
    if (curY - TABLE_ROW_HEIGHT < CONTENT_BOTTOM) {
      curPage = addBrandedPage(continuationTitle);
      curY = drawHeaderRow(curPage, CONTENT_TOP);
    }
    const rowBandBottom = curY - TABLE_ROW_HEIGHT;
    if (idx % 2 === 0) {
      curPage.drawRectangle({ x: MARGIN, y: rowBandBottom, width: tableWidth, height: TABLE_ROW_HEIGHT, color: LIGHT_TINT });
    }
    const baseline = rowBandBottom + (TABLE_ROW_HEIGHT - 8.5) / 2 + 1.5;
    cells.forEach((c, i) => {
      const fitted = fitText(c, font, 8.5, colWidths[i] - 10);
      curPage.drawText(fitted, { x: colX[i] + 6, y: baseline, size: 8.5, font, color: TEXT_DARK });
    });
    curY = rowBandBottom;
  });
}

// pdf-lib embeds standard fonts/images directly (no runtime filesystem
// reads), so unlike pdfkit it works reliably inside Next.js's bundled route
// handlers — pdfkit's dynamic .afm font-file loading breaks under webpack
// bundling, which is what caused "Failed to generate report" originally.
async function toPdf(
  totalRevenue: number,
  totalTransactions: number,
  userSummary: UserSummaryRow[],
  machineSummary: MachineSummaryRow[],
  paymentSplit: { online: PaymentSplitEntry; coin: PaymentSplitEntry; rfid: PaymentSplitEntry },
  revenueTrend: TrendBucket[],
  startLabel: string,
  endLabel: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let logoImage: PDFImage | null = null;
  try {
    logoImage = await pdfDoc.embedPng(Buffer.from(LOGO_BASE64, 'base64'));
  } catch {
    logoImage = null;
  }

  const contentWidth = PAGE_WIDTH - MARGIN * 2;

  function addBrandedPage(title: string): PDFPage {
    const p = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawBrandHeader(p, boldFont, font, logoImage, title);
    return p;
  }

  // ── Page 1: Executive Summary ──
  let page = addBrandedPage('Executive Summary');
  let y = CONTENT_TOP;

  page.drawText('Customer Usage Report', { x: MARGIN, y, size: 19, font: boldFont, color: TEXT_DARK });
  y -= 18;
  page.drawText(`Period: ${startLabel} – ${endLabel}`, { x: MARGIN, y, size: 10, font, color: TEXT_MUTED });
  y -= 30;

  const cardW = (contentWidth - 3 * 14) / 4;
  const cardH = 58;
  const cards: [string, string, RGB][] = [
    ['Total Revenue', `Rs. ${totalRevenue.toFixed(2)}`, ACCENT_GREEN],
    ['Total Transactions', String(totalTransactions), ACCENT_BLUE],
    ['Unique RFID Users', String(userSummary.length), BRAND_PINK],
    ['Machines Active', String(machineSummary.length), ACCENT_AMBER],
  ];
  cards.forEach(([label, value, accent], i) => {
    drawStatCard(page, font, boldFont, MARGIN + i * (cardW + 14), y, cardW, cardH, label, value, accent);
  });
  y -= cardH + 32;

  page.drawText('Payment Method Split', { x: MARGIN, y, size: 12.5, font: boldFont, color: TEXT_DARK });
  y -= 14;
  y = drawStackedBar(page, font, boldFont, MARGIN, y, contentWidth, [
    { label: 'Online', ...paymentSplit.online, color: ACCENT_BLUE },
    { label: 'Coin', ...paymentSplit.coin, color: ACCENT_AMBER },
    { label: 'RFID', ...paymentSplit.rfid, color: BRAND_PINK },
  ]);
  y -= 10;

  page.drawText('Revenue Trend', { x: MARGIN, y, size: 12.5, font: boldFont, color: TEXT_DARK });
  y -= 16;
  drawVerticalBarChart(page, font, MARGIN, y, contentWidth, 130, revenueTrend, BRAND_PURPLE);

  // ── Page 2: Usage Insights ──
  page = addBrandedPage('Usage Insights');
  y = CONTENT_TOP;

  const topMachines = [...machineSummary].sort((a, b) => b.count - a.count).slice(0, 8);
  y = drawRankedBarChart(
    page, font, boldFont, MARGIN, y, contentWidth,
    'Most Used Machines (by transaction count)',
    topMachines.map((m) => ({ label: m.name, value: m.count, sublabel: `Rs. ${m.amount.toFixed(0)}` })),
    ACCENT_BLUE
  );
  y -= 22;

  const topUsers = [...userSummary].sort((a, b) => b.taps - a.taps).slice(0, 8);
  drawRankedBarChart(
    page, font, boldFont, MARGIN, y, contentWidth,
    'Top RFID Users (by taps)',
    topUsers.map((u) => ({ label: u.holderName, value: u.taps, sublabel: `Rs. ${u.amount.toFixed(0)}` })),
    BRAND_PINK
  );

  // ── Page 3: Machine Usage Summary (full table) ──
  page = addBrandedPage('Machine Usage Summary');
  drawTable(
    font, boldFont,
    ['Machine', 'Location', 'Transactions', 'Revenue (Rs.)', '% of Revenue'],
    [190, 220, 100, 110, 110],
    [...machineSummary].sort((a, b) => b.count - a.count).map((m) => [
      m.name, m.location, String(m.count), m.amount.toFixed(2),
      totalRevenue > 0 ? `${((m.amount / totalRevenue) * 100).toFixed(1)}%` : '0%',
    ]),
    'No machine activity in this period.',
    page, CONTENT_TOP, addBrandedPage, 'Machine Usage Summary (cont.)'
  );

  // ── Page 4: User / RFID Card Usage Summary (full table) ──
  page = addBrandedPage('User / RFID Card Usage Summary');
  drawTable(
    font, boldFont,
    ['Holder Name', 'Card UID', 'Taps', 'Total Spent (Rs.)', 'Machines Used', 'Last Tap'],
    [150, 110, 55, 115, 225, 105],
    [...userSummary].sort((a, b) => b.taps - a.taps).map((u) => [
      u.holderName, u.cardUid, String(u.taps), u.amount.toFixed(2),
      Array.from(u.machines).join(', '), new Date(u.lastTap).toLocaleDateString('en-IN'),
    ]),
    'No RFID activity in this period.',
    page, CONTENT_TOP, addBrandedPage, 'User / RFID Card Usage Summary (cont.)'
  );

  const generatedAt = new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  const allPages = pdfDoc.getPages();
  allPages.forEach((p, i) => drawFooter(p, font, i + 1, allPages.length, generatedAt));

  return pdfDoc.save();
}

// GET /api/customer/reports?format=csv|pdf&start=YYYY-MM-DD&end=YYYY-MM-DD
export async function GET(request: NextRequest) {
  const auth = await requireCustomerAndMachines();
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'csv';
  const startParam = searchParams.get('start');
  const endParam = searchParams.get('end');

  if (!startParam || !endParam) {
    return NextResponse.json({ error: 'start and end query params are required' }, { status: 400 });
  }

  // Build end-of-day explicitly in UTC (rather than Date#setHours, which
  // mutates in the server process's local timezone) so the range is exactly
  // what the date strings say regardless of server TZ configuration.
  const start = new Date(startParam + 'T00:00:00.000Z');
  const end = new Date(endParam + 'T23:59:59.999Z');

  const machineIds = auth.machines!.map((m) => m.id);
  if (machineIds.length === 0) {
    return NextResponse.json({ error: 'No machines assigned to this account' }, { status: 404 });
  }

  const [
    { data: onlineTx, error: onlineErr },
    { data: coinTx, error: coinErr },
    { data: rfidTx, error: rfidErr },
  ] = await Promise.all([
    auth.service!
      .from('transactions')
      .select('id, total_amount, payment_status, created_at, machine_id, vending_machines!transactions_machine_id_fkey(name, location)')
      .in('machine_id', machineIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false }),
    auth.service!
      .from('coin_payments')
      .select('id, amount_in_paisa, dispensed, created_at, machine_id, products(name), vending_machines(name, location)')
      .in('machine_id', machineIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false }),
    auth.service!
      .from('rfid_payments')
      .select('id, amount_in_paisa, dispensed, created_at, machine_id, card_uid, motor_index, products(name), vending_machines(name, location), rfid_cards(holder_name)')
      .in('machine_id', machineIds)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  // A broken query (e.g. a column referenced here that doesn't exist yet in
  // the DB) must not silently degrade to an empty-but-"successful" report —
  // that's exactly what happened before this check existed: the whole
  // rfid_payments query failed, and it silently produced a 0-row CSV/PDF
  // with no indication anything was wrong.
  if (onlineErr || coinErr || rfidErr) {
    console.error('Customer report query error:', { onlineErr, coinErr, rfidErr });
    return NextResponse.json({ error: 'Failed to load transaction data for this report' }, { status: 500 });
  }

  const dispensedRfid = (rfidTx || []).filter((tx) => tx.dispensed);

  const rows: ReportRow[] = [
    ...(onlineTx || [])
      .filter((tx) => tx.payment_status === 'paid')
      .map((tx) => ({
        date: tx.created_at,
        type: 'Online' as const,
        machine: (tx.vending_machines as any)?.name || 'Unknown',
        location: (tx.vending_machines as any)?.location || '',
        amount: parseFloat(tx.total_amount || '0'),
      })),
    ...(coinTx || [])
      .filter((tx) => tx.dispensed)
      .map((tx) => ({
        date: tx.created_at,
        type: 'Coin' as const,
        machine: (tx.vending_machines as any)?.name || 'Unknown',
        location: (tx.vending_machines as any)?.location || '',
        amount: (tx.amount_in_paisa || 0) / 100,
      })),
    ...dispensedRfid.map((tx) => ({
      date: tx.created_at,
      type: 'RFID' as const,
      machine: (tx.vending_machines as any)?.name || 'Unknown',
      location: (tx.vending_machines as any)?.location || '',
      amount: (tx.amount_in_paisa || 0) / 100,
    })),
  ];

  const totalRevenue = rows.reduce((sum, r) => sum + r.amount, 0);
  const totalTransactions = rows.length;

  // Revenue split by payment method, for the stacked bar on the summary page.
  const paymentSplit = {
    online: { amount: 0, count: 0 },
    coin: { amount: 0, count: 0 },
    rfid: { amount: 0, count: 0 },
  };
  for (const r of rows) {
    const key = r.type === 'Online' ? 'online' : r.type === 'Coin' ? 'coin' : 'rfid';
    paymentSplit[key].amount += r.amount;
    paymentSplit[key].count += 1;
  }

  // Per-machine usage — which machines get consumed the most, across all
  // payment types combined, so the business can see hotspots at a glance.
  const machineSummaryMap = new Map<string, MachineSummaryRow>();
  for (const r of rows) {
    const key = `${r.machine}__${r.location}`;
    const existing = machineSummaryMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.amount += r.amount;
    } else {
      machineSummaryMap.set(key, { name: r.machine, location: r.location, count: 1, amount: r.amount });
    }
  }
  const machineSummary = Array.from(machineSummaryMap.values());

  // Per-user usage — who's tapping which RFID card, how often, and how much
  // they've spent, so the org can see actual usage rather than just totals.
  const userSummaryMap = new Map<string, UserSummaryRow>();
  for (const tx of dispensedRfid) {
    const uid = tx.card_uid;
    const holderName = (tx.rfid_cards as any)?.holder_name || 'Unknown';
    const machineName = (tx.vending_machines as any)?.name || 'Unknown';
    const amount = (tx.amount_in_paisa || 0) / 100;
    const existing = userSummaryMap.get(uid);
    if (existing) {
      existing.taps += 1;
      existing.amount += amount;
      existing.machines.add(machineName);
      if (new Date(tx.created_at) > new Date(existing.lastTap)) existing.lastTap = tx.created_at;
    } else {
      userSummaryMap.set(uid, {
        holderName, cardUid: uid, taps: 1, amount,
        machines: new Set([machineName]), lastTap: tx.created_at,
      });
    }
  }
  const userSummary = Array.from(userSummaryMap.values());

  const revenueTrend = buildRevenueTrend(rows, start, end);

  const startLabel = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const endLabel = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const filenameBase = `lyra-report-${startParam}_to_${endParam}`;

  if (format === 'csv') {
    const csv = toCsv(totalRevenue, totalTransactions, userSummary, machineSummary, startLabel, endLabel);
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filenameBase}.csv"`,
      },
    });
  }

  const pdfBytes = await toPdf(totalRevenue, totalTransactions, userSummary, machineSummary, paymentSplit, revenueTrend, startLabel, endLabel);
  return new NextResponse(pdfBytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filenameBase}.pdf"`,
    },
  });
}
