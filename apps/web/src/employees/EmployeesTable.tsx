import {
  Anchor,
  Avatar,
  Badge,
  Group,
  Skeleton,
  Stack,
  Table,
  Text,
  UnstyledButton,
} from '@mantine/core';
import {
  type EmployeeSortField,
  type SortOrder,
  formatMoney,
  getCountry,
} from '@salary-manager/shared';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router';
import type { Employee } from '../api/client';
import { employmentTypeBadge, formatDate, initialsOf } from './format';

interface EmployeesTableProps {
  /** Undefined while the first page is loading: skeleton rows are shown instead. */
  employees: Employee[] | undefined;
  sort: EmployeeSortField;
  order: SortOrder;
  onSort: (column: EmployeeSortField) => void;
  /** True while a newer page is on its way and the previous one is still on screen. */
  isStale: boolean;
}

interface Column {
  label: string;
  sortBy?: EmployeeSortField;
  alignRight?: boolean;
}

const COLUMNS: Column[] = [
  { label: 'Name', sortBy: 'name' },
  { label: 'Job title' },
  { label: 'Department' },
  { label: 'Country' },
  { label: 'Annual salary', sortBy: 'salary', alignRight: true },
  { label: 'Employment type' },
  { label: 'Hire date', sortBy: 'hireDate' },
];

const SKELETON_ROWS = 8;

function countryNameOf(code: string): string {
  try {
    return getCountry(code).name;
  } catch {
    return code;
  }
}

function HeaderCell({
  column,
  sort,
  order,
  onSort,
}: {
  column: Column;
  sort: EmployeeSortField;
  order: SortOrder;
  onSort: (column: EmployeeSortField) => void;
}): ReactElement {
  const { sortBy } = column;
  if (sortBy === undefined) {
    return <Table.Th>{column.label}</Table.Th>;
  }
  const isSorted = sort === sortBy;
  const SortIcon = !isSorted ? IconSelector : order === 'asc' ? IconChevronUp : IconChevronDown;

  return (
    <Table.Th
      ta={column.alignRight ? 'right' : undefined}
      aria-sort={isSorted ? (order === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <UnstyledButton
        fw={700}
        fz="inherit"
        onClick={() => {
          onSort(sortBy);
        }}
      >
        <Group gap={4} wrap="nowrap" component="span">
          {column.label}
          <SortIcon size={14} aria-hidden />
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}

function EmployeeRow({ employee }: { employee: Employee }): ReactElement {
  const navigate = useNavigate();
  const employmentType = employmentTypeBadge(employee.employmentType);
  const detailsPath = `/employees/${employee.id}`;

  return (
    <Table.Tr
      style={{ cursor: 'pointer' }}
      onClick={() => {
        void navigate(detailsPath);
      }}
    >
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar color="indigo" radius="xl" size="md" aria-hidden>
            {initialsOf(employee.fullName)}
          </Avatar>
          <Stack gap={0}>
            <Anchor
              component={Link}
              to={detailsPath}
              fw={600}
              c="dark"
              // The row itself also navigates; without this the click would do so twice.
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {employee.fullName}
            </Anchor>
            <Text size="sm" c="dimmed">
              {employee.email}
            </Text>
          </Stack>
        </Group>
      </Table.Td>
      <Table.Td>{employee.jobTitle}</Table.Td>
      <Table.Td>{employee.department}</Table.Td>
      <Table.Td>{countryNameOf(employee.countryCode)}</Table.Td>
      <Table.Td ta="right" style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {formatMoney(employee.salaryMinor, employee.currency)}
      </Table.Td>
      <Table.Td>
        <Badge variant="light" color={employmentType.color}>
          {employmentType.label}
        </Badge>
      </Table.Td>
      <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDate(employee.hireDate)}</Table.Td>
    </Table.Tr>
  );
}

function SkeletonRows(): ReactElement[] {
  return Array.from({ length: SKELETON_ROWS }, (_, row) => (
    <Table.Tr key={row} aria-hidden>
      {COLUMNS.map((column) => (
        <Table.Td key={column.label}>
          <Skeleton height={column.sortBy === 'name' ? 36 : 14} radius="sm" />
        </Table.Td>
      ))}
    </Table.Tr>
  ));
}

export function EmployeesTable({
  employees,
  sort,
  order,
  onSort,
  isStale,
}: EmployeesTableProps): ReactElement {
  return (
    <Table.ScrollContainer minWidth={900}>
      <Table
        verticalSpacing="sm"
        highlightOnHover={employees !== undefined}
        aria-busy={employees === undefined || isStale}
        style={{ opacity: isStale ? 0.6 : 1 }}
      >
        <Table.Thead>
          <Table.Tr>
            {COLUMNS.map((column) => (
              <HeaderCell
                key={column.label}
                column={column}
                sort={sort}
                order={order}
                onSort={onSort}
              />
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {employees === undefined
            ? SkeletonRows()
            : employees.map((employee) => <EmployeeRow key={employee.id} employee={employee} />)}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
