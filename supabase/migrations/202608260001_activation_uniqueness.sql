-- One activation per occurrence.
--
-- LocalInvestigationRepository.recordActivation was already idempotent ("if an
-- activation for this occurrence exists, return"), but the Postgres path issued a
-- plain insert against a table with no constraint to lean on. Re-approving the
-- same opportunity therefore wrote a second row, so listActivations returned
-- duplicates, the dashboard "Launched" tile and /launched double-counted, and
-- LaunchedView rendered rows sharing a React key.
--
-- Also fixes the read side: listOpportunities runs a correlated `exists` against
-- activations once per returned row (up to 500), and the only index on the table
-- was (workspace_id, created_at desc). Every one of those subqueries scanned all
-- the workspace's activations. This index makes each an index lookup.

begin;

-- Collapse any duplicates a pre-constraint deploy may already hold, keeping the
-- earliest row so the recorded launch time stays the real one.
delete from public.activations duplicate
using public.activations keeper
where duplicate.occurrence_id = keeper.occurrence_id
  and (keeper.created_at, keeper.id) < (duplicate.created_at, duplicate.id);

create unique index if not exists activations_occurrence_key
  on public.activations(occurrence_id);

commit;
