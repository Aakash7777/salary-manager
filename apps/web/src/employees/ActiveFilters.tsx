import { Badge, CloseButton, Group, Text } from '@mantine/core';
import { getCountry } from '@salary-manager/shared';
import type { ReactElement } from 'react';
import type { DirectoryQuery } from './directory-query';
import { formatCount } from './format';

interface ActiveFiltersProps {
  query: DirectoryQuery;
  /** Undefined until the first page has loaded. */
  total: number | undefined;
  onChange: (changes: Partial<DirectoryQuery>) => void;
}

function countryNameOf(code: string): string {
  try {
    return getCountry(code).name;
  } catch {
    return code;
  }
}

export function ActiveFilters({ query, total, onChange }: ActiveFiltersProps): ReactElement {
  const chips: { name: string; value: string; clear: Partial<DirectoryQuery> }[] = [
    { name: 'Search', value: query.search.trim(), clear: { search: '' } },
    {
      name: 'Country',
      value: query.country === '' ? '' : countryNameOf(query.country),
      clear: { country: '' },
    },
    { name: 'Department', value: query.department, clear: { department: '' } },
    { name: 'Job title', value: query.jobTitle, clear: { jobTitle: '' } },
  ].filter((chip) => chip.value !== '');

  return (
    <Group gap="xs" mih={28}>
      {chips.map((chip) => (
        // Mantine's Pill hides its remove button from keyboards and screen readers, so the
        // chip is a Badge with a real, labelled close button.
        <Badge
          key={chip.name}
          variant="light"
          size="lg"
          tt="none"
          fw={500}
          pr={4}
          rightSection={
            <CloseButton
              size="xs"
              variant="transparent"
              aria-label={`Remove ${chip.name} filter`}
              onClick={() => {
                onChange(chip.clear);
              }}
            />
          }
        >
          {`${chip.name}: ${chip.value}`}
        </Badge>
      ))}
      {total !== undefined && (
        <Text size="sm" c="dimmed">
          {`${formatCount(total)} ${total === 1 ? 'result' : 'results'}`}
        </Text>
      )}
    </Group>
  );
}
