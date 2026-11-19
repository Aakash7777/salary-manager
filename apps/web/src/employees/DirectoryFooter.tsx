import { Group, Pagination, Text } from '@mantine/core';
import type { ReactElement } from 'react';
import { shownRange } from './directory-query';
import { formatCount } from './format';

interface DirectoryFooterProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

const CONTROL_LABELS: Record<string, string> = {
  first: 'First page',
  previous: 'Previous page',
  next: 'Next page',
  last: 'Last page',
};

export function DirectoryFooter({
  page,
  pageSize,
  total,
  onPageChange,
}: DirectoryFooterProps): ReactElement {
  const { from, to } = shownRange(page, pageSize, total);

  return (
    <Group justify="space-between" p="md">
      <Text size="sm" c="dimmed">
        {`Showing ${formatCount(from)}–${formatCount(to)} of ${formatCount(total)}`}
      </Text>
      <Pagination
        size="sm"
        value={page}
        total={Math.ceil(total / pageSize)}
        onChange={onPageChange}
        getControlProps={(control) => ({ 'aria-label': CONTROL_LABELS[control] })}
      />
    </Group>
  );
}
