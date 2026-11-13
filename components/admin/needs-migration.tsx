/** Shown instead of a screen whose database functions are not installed yet. */
export function NeedsMigration({ migration, what }: { migration: string; what: string }) {
  return (
    <div role="status" className="rounded-lg border border-mocha bg-mocha/15 p-5">
      <p className="font-semibold">This needs a database update first</p>
      <p className="mt-1 text-sm text-muted">
        {what} becomes available once <code className="font-mono">supabase/migrations/{migration}</code> has been applied to the
        database. See <code className="font-mono">ADMIN-AUDIT.md</code> for the order to apply updates in. Nothing is broken; the
        rest of the admin works as before.
      </p>
    </div>
  );
}
