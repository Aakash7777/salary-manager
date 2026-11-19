import { Avatar, Badge, Box, Button, Group, Paper, Stack, Text, Title } from '@mantine/core';
import { formatMoney } from '@salary-manager/shared';
import { IconPencil, IconTrash } from '@tabler/icons-react';
import type { ReactElement } from 'react';
import type { EmployeeDetail, SalaryChange } from '../api/client';
import { countryNameOf, historyEntryView, roleMedianLine } from './employee-view';
import { employmentTypeBadge, formatDate, initialsOf } from './format';

interface SummaryCardProps {
  employee: EmployeeDetail;
  onEdit: () => void;
  onRemove: () => void;
}

export function SummaryCard({ employee, onEdit, onRemove }: SummaryCardProps): ReactElement {
  const employmentType = employmentTypeBadge(employee.employmentType);

  return (
    <Paper component="section" aria-label="Employee summary" withBorder p="lg">
      <Group justify="space-between" align="flex-start">
        <Group gap="md" wrap="nowrap">
          <Avatar color="indigo" radius="xl" size="lg" aria-hidden>
            {initialsOf(employee.fullName)}
          </Avatar>
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={1} size="h2">
                {employee.fullName}
              </Title>
              <Badge variant="light" color={employmentType.color}>
                {employmentType.label}
              </Badge>
            </Group>
            <Group gap="xs" c="dimmed">
              <Text>{employee.jobTitle}</Text>
              <Text aria-hidden>·</Text>
              <Text>{employee.department}</Text>
              <Text aria-hidden>·</Text>
              <Text>{countryNameOf(employee.countryCode)}</Text>
              <Text aria-hidden>·</Text>
              <Text>{`Hired ${formatDate(employee.hireDate)}`}</Text>
            </Group>
          </Stack>
        </Group>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconPencil size={16} aria-hidden />}
            onClick={onEdit}
          >
            Edit details
          </Button>
          <Button
            variant="outline"
            color="red"
            leftSection={<IconTrash size={16} aria-hidden />}
            onClick={onRemove}
          >
            Remove employee
          </Button>
        </Group>
      </Group>
    </Paper>
  );
}

interface CurrentSalaryCardProps {
  employee: EmployeeDetail;
  onChangeSalary: () => void;
}

export function CurrentSalaryCard({
  employee,
  onChangeSalary,
}: CurrentSalaryCardProps): ReactElement {
  // The history arrives newest first, so its first entry set the current salary.
  const effectiveSince = employee.salaryHistory[0]?.effectiveDate ?? employee.hireDate;

  return (
    <Paper component="section" aria-label="Current salary" withBorder p="lg">
      <Group justify="space-between" align="flex-start">
        <Stack gap={4}>
          <Text size="sm" c="dimmed" fw={500}>
            Current salary
          </Text>
          <Text fz={28} fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatMoney(employee.salaryMinor, employee.currency)}
          </Text>
          <Text size="sm" c="dimmed">{`Effective since ${formatDate(effectiveSince)}`}</Text>
          <Text size="sm" mt="xs">
            {roleMedianLine(employee)}
          </Text>
        </Stack>
        <Button onClick={onChangeSalary}>Change salary</Button>
      </Group>
    </Paper>
  );
}

export function DetailsCard({ employee }: { employee: EmployeeDetail }): ReactElement {
  const rows: [label: string, value: string][] = [
    ['Email', employee.email],
    ['Job title', employee.jobTitle],
    ['Department', employee.department],
    ['Country', countryNameOf(employee.countryCode)],
    ['Currency', `${employee.currency} (set by country)`],
    ['Employment type', employmentTypeBadge(employee.employmentType).label],
    ['Hire date', formatDate(employee.hireDate)],
  ];

  return (
    <Paper component="section" aria-label="Details" withBorder p="lg">
      <Text fw={600} mb="md">
        Details
      </Text>
      <Stack component="dl" gap="sm" m={0}>
        {rows.map(([label, value]) => (
          <Group key={label} gap="md" wrap="nowrap" align="flex-start">
            <Text component="dt" size="sm" c="dimmed" w={130}>
              {label}
            </Text>
            <Text component="dd" m={0}>
              {value}
            </Text>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}

const ENTRY_BADGES = {
  starting: { color: 'gray', label: 'Starting salary' },
  countryChange: { color: 'indigo', label: 'Country change' },
  increase: { color: 'green', label: null },
  decrease: { color: 'red', label: null },
} as const;

function HistoryEntry({ entry }: { entry: SalaryChange }): ReactElement {
  const view = historyEntryView(entry);
  const badge = ENTRY_BADGES[view.kind];

  return (
    <Box component="li" py="sm" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2}>
          <Group gap="sm">
            <Text fw={600} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {view.amounts}
            </Text>
            <Badge variant="light" color={badge.color}>
              {badge.label ?? view.percent}
            </Badge>
          </Group>
          {/* The starting entry's reason is always "Starting salary", which its badge already says. */}
          {view.kind !== 'starting' && (
            <Text size="sm" c="dimmed">
              {entry.reason}
            </Text>
          )}
        </Stack>
        <Text size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {formatDate(entry.effectiveDate)}
        </Text>
      </Group>
    </Box>
  );
}

export function SalaryHistoryCard({ history }: { history: SalaryChange[] }): ReactElement {
  return (
    <Paper component="section" withBorder p="lg">
      <Text fw={600} mb="xs">
        Salary history
      </Text>
      <Box component="ol" aria-label="Salary history" m={0} p={0} style={{ listStyle: 'none' }}>
        {history.map((entry) => (
          <HistoryEntry key={entry.id} entry={entry} />
        ))}
      </Box>
    </Paper>
  );
}
