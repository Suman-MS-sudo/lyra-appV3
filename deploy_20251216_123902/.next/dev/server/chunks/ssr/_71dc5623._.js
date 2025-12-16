module.exports = [
"[project]/src/lib/supabase/server.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createClient",
    ()=>createClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$index$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/index.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/ssr/dist/module/createServerClient.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
;
;
async function createClient() {
    const cookieStore = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$ssr$2f$dist$2f$module$2f$createServerClient$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createServerClient"])(("TURBOPACK compile-time value", "https://fjghhrubobqwplvokszz.supabase.co"), ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqZ2hocnVib2Jxd3Bsdm9rc3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTU2OTUsImV4cCI6MjA4MDY3MTY5NX0.t84NMCPSj-nd7kUFX7Gjx7zsHkpkiQI5kbcAVbXbsxc"), {
        cookies: {
            getAll () {
                return cookieStore.getAll();
            },
            setAll (cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options })=>cookieStore.set(name, value, options));
                } catch  {
                // Server Component - cookies().set() will fail
                }
            }
        }
    });
}
}),
"[project]/src/app/actions/organization-billing.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* __next_internal_action_entry_do_not_use__ [{"0036fd386d47db1f17e07fdda038407061446fd078":"getAllInvoices","004056b2280833519c744070d9ee8ca5d89a0e94b9":"generateMonthlyInvoices","400ffe13d9d60660da1f4f75707c45bd7a8d42a8cf":"deleteInvoice","4040bf904b0a48cd46716b1177b1cd76811153c445":"sendInvoiceEmail","404f644292532771f1ee1badbf7252ae8f94381d28":"generateInvoice","40d178a8f96b1deaa3fc3885c35fcf80f7ea3cad8a":"getInvoiceDetails","40d9026d24773b6ba9c005942510adce7747ccf182":"recordManualPayment"},"",""] */ __turbopack_context__.s([
    "deleteInvoice",
    ()=>deleteInvoice,
    "generateInvoice",
    ()=>generateInvoice,
    "generateMonthlyInvoices",
    ()=>generateMonthlyInvoices,
    "getAllInvoices",
    ()=>getAllInvoices,
    "getInvoiceDetails",
    ()=>getInvoiceDetails,
    "recordManualPayment",
    ()=>recordManualPayment,
    "sendInvoiceEmail",
    ()=>sendInvoiceEmail
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/server-reference.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/supabase/server.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/build/webpack/loaders/next-flight-loader/action-validate.js [app-rsc] (ecmascript)");
;
;
;
const serviceSupabase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])(("TURBOPACK compile-time value", "https://fjghhrubobqwplvokszz.supabase.co"), process.env.SUPABASE_SERVICE_ROLE_KEY);
async function generateInvoice(params) {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        throw new Error('Only admins can generate invoices');
    }
    const { organizationId, periodStart, periodEnd } = params;
    // Check if invoice already exists for this period
    const { data: existing } = await serviceSupabase.from('organization_invoices').select('id').eq('organization_id', organizationId).eq('period_start', periodStart).eq('period_end', periodEnd).single();
    if (existing) {
        throw new Error('Invoice already exists for this period');
    }
    // Calculate amounts using the database function
    const { data: amounts, error: calcError } = await serviceSupabase.rpc('calculate_invoice_amounts', {
        p_organization_id: organizationId,
        p_period_start: periodStart,
        p_period_end: periodEnd
    });
    if (calcError) throw calcError;
    const totalAmount = amounts?.[0]?.total_amount_paisa || 0;
    const totalTransactions = amounts?.[0]?.total_transactions || 0;
    // Generate invoice number
    const { data: invoiceNumber } = await serviceSupabase.rpc('generate_invoice_number');
    // Create invoice
    const { data: invoice, error: insertError } = await serviceSupabase.from('organization_invoices').insert({
        organization_id: organizationId,
        invoice_number: invoiceNumber,
        period_start: periodStart,
        period_end: periodEnd,
        total_coin_transactions: totalTransactions,
        total_amount_paisa: totalAmount,
        amount_paid_paisa: 0,
        amount_due_paisa: totalAmount,
        status: totalAmount > 0 ? 'pending' : 'draft'
    }).select().single();
    if (insertError) throw insertError;
    return {
        success: true,
        invoice
    };
}
async function generateMonthlyInvoices() {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        throw new Error('Only admins can generate invoices');
    }
    // Get all active organizations
    const { data: organizations } = await serviceSupabase.from('organizations').select('id, name');
    if (!organizations) return {
        success: false,
        message: 'No organizations found'
    };
    // Calculate previous month period
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const periodStart = lastMonth.toISOString();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const results = [];
    for (const org of organizations){
        try {
            const result = await generateInvoice({
                organizationId: org.id,
                periodStart,
                periodEnd
            });
            results.push({
                organizationId: org.id,
                name: org.name,
                success: true,
                invoice: result.invoice
            });
        } catch (error) {
            results.push({
                organizationId: org.id,
                name: org.name,
                success: false,
                error: error.message
            });
        }
    }
    return {
        success: true,
        results
    };
}
async function sendInvoiceEmail(params) {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        throw new Error('Only admins can send invoice emails');
    }
    const { invoiceId } = params;
    // Get invoice with organization details
    const { data: invoice, error: fetchError } = await serviceSupabase.from('organization_invoices').select(`
      *,
      organizations (
        id,
        name,
        contact_email
      )
    `).eq('id', invoiceId).single();
    if (fetchError || !invoice) {
        throw new Error('Invoice not found');
    }
    if (!invoice.organizations.contact_email) {
        throw new Error('Organization does not have a contact email');
    }
    // Import email utilities
    const { sendEmail, generateInvoiceEmailHTML } = await __turbopack_context__.A("[project]/src/lib/email.ts [app-rsc] (ecmascript, async loader)");
    // Generate email content
    const appUrl = ("TURBOPACK compile-time value", "https://lyra-app.co.in") || 'https://lyra-app.co.in';
    const invoiceUrl = `${appUrl}/admin/billing/${invoice.id}`;
    const paymentUrl = `${appUrl}/admin/billing/${invoice.id}/pay`;
    const formatCurrency = (paisa)=>{
        return `₹${(paisa / 100).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    };
    const formatDate = (date)=>{
        return new Date(date).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };
    // Calculate due date: 30 days from invoice creation
    const dueDate = new Date(invoice.created_at);
    dueDate.setDate(dueDate.getDate() + 30);
    const emailHTML = generateInvoiceEmailHTML({
        invoiceNumber: invoice.invoice_number,
        organizationName: invoice.organizations.name,
        totalAmount: formatCurrency(invoice.total_amount_paisa),
        dueDate: invoice.status === 'paid' && invoice.paid_at ? `Paid on ${formatDate(invoice.paid_at)}` : formatDate(dueDate.toISOString()),
        invoiceUrl,
        paymentUrl,
        totalAmountPaisa: invoice.total_amount_paisa
    });
    // Determine email subject based on amount
    const emailSubject = invoice.total_amount_paisa === 0 ? `Monthly Statement ${invoice.invoice_number} - No Payment Required` : `Invoice ${invoice.invoice_number} from Lyra Enterprises`;
    // Send email
    const result = await sendEmail({
        to: invoice.organizations.contact_email,
        subject: emailSubject,
        html: emailHTML
    });
    if (!result.success) {
        throw new Error(`Failed to send email: ${result.error}`);
    }
    // Update invoice email tracking
    await serviceSupabase.from('organization_invoices').update({
        email_sent: true,
        email_sent_at: new Date().toISOString(),
        reminder_count: (invoice.reminder_count || 0) + 1,
        last_reminder_sent_at: new Date().toISOString()
    }).eq('id', invoiceId);
    return {
        success: true,
        invoice,
        message: `Email sent to ${invoice.organizations.contact_email}`
    };
}
async function recordManualPayment(params) {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        throw new Error('Only admins can record payments');
    }
    const { invoiceId, amountPaisa, notes } = params;
    // Get invoice
    const { data: invoice, error: fetchError } = await serviceSupabase.from('organization_invoices').select('*, organizations(id)').eq('id', invoiceId).single();
    if (fetchError || !invoice) {
        throw new Error('Invoice not found');
    }
    // Create payment record
    const { data: payment, error: paymentError } = await serviceSupabase.from('organization_payments').insert({
        invoice_id: invoiceId,
        organization_id: invoice.organizations.id,
        amount_paisa: amountPaisa,
        payment_method: 'manual',
        status: 'success',
        notes: notes || 'Manual payment recorded by admin',
        payment_date: new Date().toISOString()
    }).select().single();
    if (paymentError) throw paymentError;
    return {
        success: true,
        payment
    };
}
async function getAllInvoices() {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        throw new Error('Unauthorized');
    }
    const { data: invoices, error } = await serviceSupabase.from('organization_invoices').select(`
      *,
      organizations (
        id,
        name,
        email
      )
    `).order('created_at', {
        ascending: false
    });
    if (error) throw error;
    return {
        success: true,
        invoices
    };
}
async function getInvoiceDetails(invoiceId) {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: invoice, error } = await serviceSupabase.from('organization_invoices').select(`
      *,
      organizations (
        id,
        name,
        email
      ),
      organization_payments (
        id,
        amount_paisa,
        payment_method,
        status,
        payment_date,
        razorpay_payment_id,
        notes
      )
    `).eq('id', invoiceId).single();
    if (error) throw error;
    return {
        success: true,
        invoice
    };
}
async function deleteInvoice(invoiceId) {
    const supabase = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$supabase$2f$server$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createClient"])();
    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    const { data: profile } = await serviceSupabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') {
        throw new Error('Only admins can delete invoices');
    }
    // Delete invoice (cascade will delete associated payments)
    const { error } = await serviceSupabase.from('organization_invoices').delete().eq('id', invoiceId);
    if (error) throw error;
    // Revalidate the billing page to reflect changes
    const { revalidatePath } = await __turbopack_context__.A("[project]/node_modules/next/cache.js [app-rsc] (ecmascript, async loader)");
    revalidatePath('/admin/billing');
    return {
        success: true,
        message: 'Invoice deleted successfully'
    };
}
;
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$action$2d$validate$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["ensureServerEntryExports"])([
    generateInvoice,
    generateMonthlyInvoices,
    sendInvoiceEmail,
    recordManualPayment,
    getAllInvoices,
    getInvoiceDetails,
    deleteInvoice
]);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(generateInvoice, "404f644292532771f1ee1badbf7252ae8f94381d28", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(generateMonthlyInvoices, "004056b2280833519c744070d9ee8ca5d89a0e94b9", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(sendInvoiceEmail, "4040bf904b0a48cd46716b1177b1cd76811153c445", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(recordManualPayment, "40d9026d24773b6ba9c005942510adce7747ccf182", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getAllInvoices, "0036fd386d47db1f17e07fdda038407061446fd078", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(getInvoiceDetails, "40d178a8f96b1deaa3fc3885c35fcf80f7ea3cad8a", null);
(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$webpack$2f$loaders$2f$next$2d$flight$2d$loader$2f$server$2d$reference$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerServerReference"])(deleteInvoice, "400ffe13d9d60660da1f4f75707c45bd7a8d42a8cf", null);
}),
"[project]/.next-internal/server/app/admin/billing/[invoiceId]/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/organization-billing.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$organization$2d$billing$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/organization-billing.ts [app-rsc] (ecmascript)");
;
}),
"[project]/.next-internal/server/app/admin/billing/[invoiceId]/page/actions.js { ACTIONS_MODULE0 => \"[project]/src/app/actions/organization-billing.ts [app-rsc] (ecmascript)\" } [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "4040bf904b0a48cd46716b1177b1cd76811153c445",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$organization$2d$billing$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["sendInvoiceEmail"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f2e$next$2d$internal$2f$server$2f$app$2f$admin$2f$billing$2f5b$invoiceId$5d2f$page$2f$actions$2e$js__$7b$__ACTIONS_MODULE0__$3d3e$__$225b$project$5d2f$src$2f$app$2f$actions$2f$organization$2d$billing$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$2922$__$7d$__$5b$app$2d$rsc$5d$__$28$server__actions__loader$2c$__ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i('[project]/.next-internal/server/app/admin/billing/[invoiceId]/page/actions.js { ACTIONS_MODULE0 => "[project]/src/app/actions/organization-billing.ts [app-rsc] (ecmascript)" } [app-rsc] (server actions loader, ecmascript) <locals>');
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$app$2f$actions$2f$organization$2d$billing$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/app/actions/organization-billing.ts [app-rsc] (ecmascript)");
}),
];

//# sourceMappingURL=_71dc5623._.js.map