import { LocalInvestigationRepository } from "./local-repository";
import type { InvestigationRepository } from "./repository";

let repository: InvestigationRepository | null = null;

/**
 * Demo/local mode is intentionally zero-configuration. Production selects the
 * Supabase Postgres repository whenever DATABASE_URL is configured.
 */
export async function getInvestigationRepository(): Promise<InvestigationRepository> {
  if (repository) return repository;
  if (process.env.DATABASE_URL) {
    const { PostgresInvestigationRepository } = await import("./postgres-repository");
    repository = new PostgresInvestigationRepository(process.env.DATABASE_URL);
  } else {
    repository = new LocalInvestigationRepository();
  }
  return repository;
}

export function resetInvestigationRepositoryForTests(): void {
  repository = null;
}
