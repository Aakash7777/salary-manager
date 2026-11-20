import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { type SimulatorQuery, parseSimulatorQuery, toSimulatorUrlParams } from './simulator-query';

export interface SimulatorQueryState {
  query: SimulatorQuery;
  /** Applies changes to the URL. */
  update: (changes: Partial<SimulatorQuery>) => void;
  /** Back to everyone. The percentage stays. */
  clearFilters: () => void;
}

export function useSimulatorQuery(): SimulatorQueryState {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseSimulatorQuery(searchParams), [searchParams]);

  const update = useCallback(
    (changes: Partial<SimulatorQuery>) => {
      setSearchParams((current) =>
        toSimulatorUrlParams({ ...parseSimulatorQuery(current), ...changes }),
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    update({ search: '', country: '', department: '', jobTitle: '' });
  }, [update]);

  return { query, update, clearFilters };
}
