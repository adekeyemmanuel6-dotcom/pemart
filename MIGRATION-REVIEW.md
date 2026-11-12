# Migration 0014 review and release sequence

Status: prepared and tested in an isolated PGlite PostgreSQL database with local Supabase auth/storage stubs. NOT applied to production or any connected Supabase project.

1. Back up the existing Supabase project and compare its actual schema, function definitions and RLS policies with migrations 0001–0013. The repository is the only schema inspected in this session.
2. Review `supabase/migrations/0014_wear_the_word.sql`. It adds content/shipping settings, product themes/brand assignments/verified packed weights, destination/service fields, verification flags and order shipping snapshots. Existing IDs, foreign keys, prices and customer records remain. It updates the admin RPC allowlists and shipping validation within the existing order transaction. Paystack signature verification and idempotent settlement remain.
3. Plan a maintenance window or test against a staging copy. Existing rates become unverified. Review and confirm their fees/coverage in the upgraded admin before reopening checkout. No national price list is seeded. The national threshold defaults to 20,000,000 kobo (₦200,000).
4. Confirm existing products' themes and brand collection assignments. The migration maps existing verse-based designs to Scripture, known matching designs to Together, and three existing declaration designs to Declaration. It does not rename product IDs or legacy collections.
5. Verify state/city services, complete a Paystack test transaction and replay its webhook, check stock/order/proof flows, test admin permissions using genuine accounts, and run the repository integration/browser suites against staging.
6. Approve the reviewed changes before deployment to the EXISTING Vercel project. No push to its connected deployment branch or Vercel deployment was performed in this session.

## Rollback

`supabase/rollback/0014_wear_the_word.sql` restores the original function definitions without deleting columns, assignments, orders or configuration. Revert the application code as part of the same rollback. Keep the new columns/snapshots for recovery and export settings before reverting. Re-enabling the upgrade after this rollback requires restoring the updated function definitions from 0014, not running its column additions a second time. Do not delete new columns from a live database as a casual rollback step.

## Operational limitations

Weight-restricted services need verified packed product weights. Bundles/custom garments have no verified package-weight source in the original schema; they require a confirmed flat-rate service until the business provides that data. Historical orders without snapshots retain their existing timing behavior. No migration can verify carrier prices or production promises automatically.
