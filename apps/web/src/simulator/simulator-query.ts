import { raisePctSchema } from '@salary-manager/shared';
import type { RaiseSimulationRequest } from '../api/client';
import { formatCount } from '../employees/format';

/** Everything the simulator shows is decided by this, and all of it lives in the URL. */
export interface SimulatorQuery {
  search: string;
  country: string;
  department: string;
  jobTitle: string;
  pct: number;
}

const DEFAULT_PCT = 0;
const PLAIN_NUMBER = /^\d+(\.\d+)?$/;

/** A percentage the shared schema accepts, or the default when the URL holds anything else. */
function pctFrom(raw: string | null): number {
  if (raw === null || !PLAIN_NUMBER.test(raw)) {
    return DEFAULT_PCT;
  }
  const parsed = raisePctSchema.safeParse(Number(raw));
  return parsed.success ? parsed.data : DEFAULT_PCT;
}

/** Reads the URL. Anything missing or not understood falls back to its default. */
export function parseSimulatorQuery(params: URLSearchParams): SimulatorQuery {
  return {
    search: params.get('search') ?? '',
    country: params.get('country') ?? '',
    department: params.get('department') ?? '',
    jobTitle: params.get('jobTitle') ?? '',
    pct: pctFrom(params.get('pct')),
  };
}

function setFilters(query: SimulatorQuery): Record<string, string> {
  const filters: Record<string, string> = {};
  if (query.search.trim() !== '') filters.search = query.search.trim();
  if (query.country !== '') filters.country = query.country;
  if (query.department !== '') filters.department = query.department;
  if (query.jobTitle !== '') filters.jobTitle = query.jobTitle;
  return filters;
}

/** Writes the URL, leaving out empty values and the default so links stay short. */
export function toSimulatorUrlParams(query: SimulatorQuery): Record<string, string> {
  const params = setFilters(query);
  if (query.pct !== DEFAULT_PCT) params.pct = String(query.pct);
  return params;
}

export function toSimulationRequest(query: SimulatorQuery): RaiseSimulationRequest {
  return { filters: setFilters(query), pct: query.pct };
}

/** "USD 29,783,866": whole dollars, rounded half up with integer maths. The figure is indicative. */
export function usdRoundedToWholeDollars(usdMinor: number): string {
  const wholeDollars = Number((BigInt(usdMinor) + 50n) / 100n);
  return `USD ${formatCount(wholeDollars)}`;
}
