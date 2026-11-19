import { Badge, Button, Group, Paper, Stack, Text, Title, VisuallyHidden } from '@mantine/core';
import { IconDownload, IconPlus } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type ReactElement, useState } from 'react';
import { api } from '../api/client';
import { ActiveFilters } from './ActiveFilters';
import { AddEmployeeDrawer } from './AddEmployeeDrawer';
import { DirectoryFilters } from './DirectoryFilters';
import { DirectoryFooter } from './DirectoryFooter';
import { EmptyState, ErrorState } from './DirectoryStates';
import { EmployeesTable } from './EmployeesTable';
import { exportCsvHref, sortedBy, toApiParams } from './directory-query';
import { formatCount } from './format';
import { useDirectoryQuery } from './useDirectoryQuery';

const META_STALE_MS = 5 * 60 * 1000;

export function EmployeesPage(): ReactElement {
  const { query, update, clearFilters } = useDirectoryQuery();
  const apiParams = toApiParams(query);
  const [isAdding, setIsAdding] = useState(false);

  const employees = useQuery({
    queryKey: ['employees', apiParams],
    queryFn: ({ signal }) => api.getEmployees(apiParams, signal),
    // The page already on screen stays there until the next one arrives.
    placeholderData: keepPreviousData,
  });
  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => api.getMeta(signal),
    staleTime: META_STALE_MS,
  });

  const page = employees.data;
  const sortsSalaryAcrossCurrencies = query.sort === 'salary' && query.country === '';

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Group gap="sm">
          <Title order={1} size="h2">
            Employees
          </Title>
          {page && (
            <Badge variant="light" color="gray" size="lg" aria-label="Total employees">
              {formatCount(page.total)}
            </Badge>
          )}
        </Group>
        <Group gap="sm">
          <Button
            component="a"
            href={exportCsvHref(query)}
            variant="default"
            leftSection={<IconDownload size={16} aria-hidden />}
          >
            Export CSV
          </Button>
          <Button
            leftSection={<IconPlus size={16} aria-hidden />}
            onClick={() => {
              setIsAdding(true);
            }}
          >
            Add employee
          </Button>
        </Group>
      </Group>

      <DirectoryFilters query={query} meta={meta.data} onChange={update} onClear={clearFilters} />
      <ActiveFilters query={query} total={page?.total} onChange={update} />

      <Paper withBorder>
        {employees.isError ? (
          <ErrorState
            message={employees.error.message}
            onRetry={() => {
              void employees.refetch();
            }}
          />
        ) : page?.total === 0 ? (
          <EmptyState onClearFilters={clearFilters} />
        ) : (
          <>
            {employees.isPending && <VisuallyHidden>Loading employees</VisuallyHidden>}
            {sortsSalaryAcrossCurrencies && (
              <Text size="sm" c="dimmed" px="md" pt="sm">
                Sorted by amount. Currencies are not converted.
              </Text>
            )}
            <EmployeesTable
              employees={page?.items}
              sort={query.sort}
              order={query.order}
              onSort={(column) => {
                update(sortedBy(query, column));
              }}
              isStale={employees.isPlaceholderData}
            />
            {page && (
              <DirectoryFooter
                page={page.page}
                pageSize={page.pageSize}
                total={page.total}
                onPageChange={(nextPage) => {
                  update({ page: nextPage });
                }}
              />
            )}
          </>
        )}
      </Paper>

      <AddEmployeeDrawer
        opened={isAdding}
        meta={meta.data}
        onClose={() => {
          setIsAdding(false);
        }}
      />
    </Stack>
  );
}
