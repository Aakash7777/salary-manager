import {
  Anchor,
  Box,
  Breadcrumbs,
  Button,
  SimpleGrid,
  Skeleton,
  Stack,
  Text,
  VisuallyHidden,
} from '@mantine/core';
import { IconAlertTriangle, IconUserOff } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { type ReactElement, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ApiError, api } from '../api/client';
import { PageMessage } from '../components/PageMessage';
import { ChangeSalaryModal } from './ChangeSalaryModal';
import { EditDetailsDrawer } from './EditDetailsDrawer';
import { CurrentSalaryCard, DetailsCard, SalaryHistoryCard, SummaryCard } from './EmployeeCards';
import { RemoveEmployeeModal } from './RemoveEmployeeModal';

const META_STALE_MS = 5 * 60 * 1000;

type OpenDialog = 'edit' | 'changeSalary' | 'remove' | null;

function NotFound(): ReactElement {
  return (
    <PageMessage
      icon={<IconUserOff size={28} aria-hidden />}
      color="gray"
      title="Employee not found"
    >
      <Text c="dimmed">They may have been removed, or the link may be wrong.</Text>
      <Button component={Link} to="/employees" variant="light">
        Back to Employees
      </Button>
    </PageMessage>
  );
}

function LoadingSkeleton(): ReactElement {
  return (
    <Stack gap="lg">
      <VisuallyHidden>Loading employee</VisuallyHidden>
      <Skeleton height={96} radius="md" />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Skeleton height={180} radius="md" />
        <Skeleton height={180} radius="md" />
      </SimpleGrid>
      <Skeleton height={220} radius="md" />
    </Stack>
  );
}

export function EmployeeDetailPage(): ReactElement {
  const { id: idParam = '' } = useParams();
  // Anything that is not a whole number cannot be an employee id, so it is not even asked for.
  const id = /^\d+$/.test(idParam) ? Number(idParam) : null;
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const closeDialog = (): void => {
    setOpenDialog(null);
  };

  const employee = useQuery({
    queryKey: ['employee', id],
    queryFn: ({ signal }) => api.getEmployee(id ?? 0, signal),
    enabled: id !== null,
  });
  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => api.getMeta(signal),
    staleTime: META_STALE_MS,
  });

  if (id === null || (employee.error instanceof ApiError && employee.error.status === 404)) {
    return <NotFound />;
  }
  if (employee.isError) {
    return (
      <PageMessage
        icon={<IconAlertTriangle size={28} aria-hidden />}
        color="red"
        title="Could not load this employee"
      >
        <Text c="dimmed">{employee.error.message}</Text>
        <Button
          variant="light"
          onClick={() => {
            void employee.refetch();
          }}
        >
          Retry
        </Button>
      </PageMessage>
    );
  }
  if (employee.isPending) {
    return <LoadingSkeleton />;
  }

  const person = employee.data;
  return (
    <Stack gap="lg">
      <Box component="nav" aria-label="Breadcrumb">
        <Breadcrumbs>
          <Anchor component={Link} to="/employees">
            Employees
          </Anchor>
          <Text>{person.fullName}</Text>
        </Breadcrumbs>
      </Box>

      <SummaryCard
        employee={person}
        onEdit={() => {
          setOpenDialog('edit');
        }}
        onRemove={() => {
          setOpenDialog('remove');
        }}
      />
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <CurrentSalaryCard
          employee={person}
          onChangeSalary={() => {
            setOpenDialog('changeSalary');
          }}
        />
        <DetailsCard employee={person} />
      </SimpleGrid>
      <SalaryHistoryCard history={person.salaryHistory} />

      <EditDetailsDrawer
        opened={openDialog === 'edit'}
        employee={person}
        meta={meta.data}
        onClose={closeDialog}
      />
      <ChangeSalaryModal
        opened={openDialog === 'changeSalary'}
        employee={person}
        onClose={closeDialog}
      />
      <RemoveEmployeeModal
        opened={openDialog === 'remove'}
        employee={person}
        onClose={closeDialog}
      />
    </Stack>
  );
}
