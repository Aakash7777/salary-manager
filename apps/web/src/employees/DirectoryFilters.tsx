import { Button, Group, Paper, Select, TextInput } from '@mantine/core';
import { getCountry } from '@salary-manager/shared';
import { IconSearch } from '@tabler/icons-react';
import { type ReactElement, useEffect, useState } from 'react';
import type { Meta } from '../api/client';
import type { DirectoryQuery } from './directory-query';

const SEARCH_DEBOUNCE_MS = 300;

/** The search and the three filters: what these controls show and change. */
export type DirectoryFilterValues = Pick<
  DirectoryQuery,
  'search' | 'country' | 'department' | 'jobTitle'
>;

interface DirectoryFiltersProps {
  query: DirectoryFilterValues;
  meta: Meta | undefined;
  onChange: (changes: Partial<DirectoryFilterValues>) => void;
  onClear: () => void;
}

interface Option {
  value: string;
  label: string;
}

/** Until the choices have loaded, the current value is offered alone so it still shows. */
function optionsOrCurrent(loaded: Option[] | undefined, current: Option | undefined): Option[] {
  return loaded ?? (current ? [current] : []);
}

function countryNameOf(code: string): string {
  try {
    return getCountry(code).name;
  } catch {
    return code;
  }
}

function asOption(value: string): Option | undefined {
  return value === '' ? undefined : { value, label: value };
}

export function DirectoryFilters({
  query,
  meta,
  onChange,
  onClear,
}: DirectoryFiltersProps): ReactElement {
  // The box shows what is being typed; the URL only follows once typing pauses.
  const [draft, setDraft] = useState(query.search);
  const [searchInUrl, setSearchInUrl] = useState(query.search);
  if (query.search !== searchInUrl) {
    // The URL changed from outside the box (a chip was removed, or Back was pressed).
    setSearchInUrl(query.search);
    setDraft(query.search);
  }

  useEffect(() => {
    if (draft === query.search) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      onChange({ search: draft });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, query.search, onChange]);

  const countryOptions = optionsOrCurrent(
    meta?.countries.map((country) => ({ value: country.code, label: country.name })),
    query.country === ''
      ? undefined
      : { value: query.country, label: countryNameOf(query.country) },
  );

  return (
    <Paper withBorder p="md">
      <Group align="flex-end" gap="md">
        <TextInput
          aria-label="Search by name or email"
          placeholder="Search by name or email"
          leftSection={<IconSearch size={16} aria-hidden />}
          value={draft}
          onChange={(event) => {
            setDraft(event.currentTarget.value);
          }}
          flex={2}
          miw={220}
        />
        <Select
          label="Country"
          placeholder="All countries"
          data={countryOptions}
          value={query.country === '' ? null : query.country}
          onChange={(value) => {
            onChange({ country: value ?? '' });
          }}
          searchable
          clearable
          clearButtonProps={{ 'aria-label': 'Clear country' }}
          flex={1}
          miw={160}
        />
        <Select
          label="Department"
          placeholder="All departments"
          data={optionsOrCurrent(
            meta?.departments.map((department) => ({ value: department, label: department })),
            asOption(query.department),
          )}
          value={query.department === '' ? null : query.department}
          onChange={(value) => {
            onChange({ department: value ?? '' });
          }}
          searchable
          clearable
          clearButtonProps={{ 'aria-label': 'Clear department' }}
          flex={1}
          miw={160}
        />
        <Select
          label="Job title"
          placeholder="All job titles"
          data={optionsOrCurrent(
            meta?.jobTitles.map((jobTitle) => ({ value: jobTitle, label: jobTitle })),
            asOption(query.jobTitle),
          )}
          value={query.jobTitle === '' ? null : query.jobTitle}
          onChange={(value) => {
            onChange({ jobTitle: value ?? '' });
          }}
          searchable
          clearable
          clearButtonProps={{ 'aria-label': 'Clear job title' }}
          flex={1}
          miw={160}
        />
        <Button variant="subtle" color="gray" onClick={onClear}>
          Clear filters
        </Button>
      </Group>
    </Paper>
  );
}
