-- Migration 007 — lets signed-in users delete an expense. Safe to re-run; changes no existing data.
-- Every deleted expense is kept in the Activity log (old data), so it can be traced later.
drop policy if exists "Authenticated can delete expenses" on expenses;
create policy "Authenticated can delete expenses" on expenses for delete to authenticated using (true);
