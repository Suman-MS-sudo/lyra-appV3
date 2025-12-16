module.exports = [
"[project]/src/lib/email.ts [app-rsc] (ecmascript, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "server/chunks/ssr/node_modules_nodemailer_ba4ecd24._.js",
  "server/chunks/ssr/[root-of-the-server]__c40159ba._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/src/lib/email.ts [app-rsc] (ecmascript)");
    });
});
}),
];