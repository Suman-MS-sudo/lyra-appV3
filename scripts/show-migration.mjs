import { readFileSync } from 'fs';

const migrationFile = process.argv[2] || '20231207000007_extend_vending_machines.sql';
const sql = readFileSync(`supabase/migrations/${migrationFile}`, 'utf-8');

console.log(`\n📋 Copy this SQL and run it in Supabase SQL Editor:\n`);
console.log('🔗 URL: https://fjghhrubobqwplvokszz.supabase.co/project/fjghhrubobqwplvokszz/sql/new\n');
console.log('─'.repeat(80));
console.log(sql);
console.log('─'.repeat(80));
console.log(`\n✅ Migration: ${migrationFile}\n`);
