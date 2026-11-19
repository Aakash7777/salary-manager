const DEFAULT_DATABASE_PATH = 'salary-manager.db';

export function resolveDatabasePath(env: Record<string, string | undefined>): string {
  const configured = env.DATABASE_PATH?.trim();
  return configured ? configured : DEFAULT_DATABASE_PATH;
}
