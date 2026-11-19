import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import {
  type DirectoryQuery,
  parseDirectoryQuery,
  toUrlParams,
  withoutFilters,
} from './directory-query';

export interface DirectoryQueryState {
  query: DirectoryQuery;
  /** Applies changes to the URL. Any change other than the page itself returns to page 1. */
  update: (changes: Partial<DirectoryQuery>) => void;
  clearFilters: () => void;
}

export function useDirectoryQuery(): DirectoryQueryState {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo(() => parseDirectoryQuery(searchParams), [searchParams]);

  const update = useCallback(
    (changes: Partial<DirectoryQuery>) => {
      setSearchParams((current) =>
        toUrlParams({ ...parseDirectoryQuery(current), page: 1, ...changes }),
      );
    },
    [setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchParams((current) => toUrlParams(withoutFilters(parseDirectoryQuery(current))));
  }, [setSearchParams]);

  return { query, update, clearFilters };
}
