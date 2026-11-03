/**
 * CLI runner for SQLite to MongoDB Event Migration & Verification
 * Usage: npx tsx scripts/migrate-to-mongodb.ts
 */

import { runMongoMigration } from '../src/lib/mongoMigration';

async function main() {
  console.log('========================================================');
  console.log('TECHFORM BUDDY: FORM WATCH & EVENTS MONGODB MIGRATION');
  console.log('========================================================');

  const result = await runMongoMigration();

  console.log(`\nAudit Timestamp: ${result.timestamp}`);
  console.log(`Mode: ${result.mode}`);
  console.log(`Total Records Extracted: ${result.totalRecordsExtracted}`);
  console.log(`Duplicates Found: ${result.duplicatesFound}`);
  console.log(`Relational Integrity: ${result.relationshipIntegrity.isValid ? 'VALID ✓' : 'FAILED ✗'}`);

  console.log('\n--- Table Summaries ---');
  for (const [table, summary] of Object.entries(result.tables)) {
    console.log(`- ${table}: ${summary.recordCount} records (Duplicates: ${summary.duplicateCount})`);
  }

  console.log('\n--- Verification Details ---');
  for (const line of result.details) {
    console.log(`✓ ${line}`);
  }

  if (result.isVerified) {
    console.log('\nSUCCESS: 100% of event records, bookmarks, and reminders verified.');
  } else {
    console.error('\nERROR: Data verification failed.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
