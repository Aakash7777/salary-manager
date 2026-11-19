import { Button, Drawer, Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { createEmployeeInputSchema, currencyFor } from '@salary-manager/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { type Meta, api } from '../api/client';
import { EmployeeDetailFields, SalaryInput } from './form-fields';
import {
  EMPTY_EMPLOYEE_FORM,
  type EmployeeFormValues,
  detailValuesOf,
  localIsoDate,
  withoutBlanks,
} from './form-input';
import { notifySaved, showSchemaIssues, showServerError } from './save-feedback';

interface AddEmployeeDrawerProps {
  opened: boolean;
  meta: Meta | undefined;
  onClose: () => void;
}

function currencyOf(countryCode: string): string {
  return countryCode === '' ? '' : currencyFor(countryCode);
}

function AddEmployeeForm({ meta, onClose }: Omit<AddEmployeeDrawerProps, 'opened'>): ReactElement {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const form = useForm<EmployeeFormValues>({
    mode: 'controlled',
    initialValues: EMPTY_EMPLOYEE_FORM,
  });

  const create = useMutation({
    mutationFn: api.createEmployee,
    onSuccess: async (created) => {
      onClose();
      notifySaved('Employee added', `${created.fullName} was added.`);
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await queryClient.invalidateQueries({ queryKey: ['meta'] });
      await navigate(`/employees/${created.id}`);
    },
    onError: (error) => {
      showServerError(form, error);
    },
  });

  const submit = (): void => {
    const input = withoutBlanks({
      ...detailValuesOf(form.values),
      salaryMajor: form.values.salaryMajor,
    });
    const parsed = createEmployeeInputSchema(localIsoDate(new Date())).safeParse(input);
    if (!parsed.success) {
      showSchemaIssues(form, parsed.error.issues);
      return;
    }
    form.clearErrors();
    create.mutate(parsed.data);
  };

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Stack gap="md">
        <EmployeeDetailFields form={form} meta={meta} />
        <SalaryInput
          label="Annual base salary"
          currency={currencyOf(form.values.countryCode)}
          value={form.values.salaryMajor}
          onChange={(value) => {
            form.setFieldValue('salaryMajor', value);
          }}
          error={form.errors.salaryMajor}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Add employee
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function AddEmployeeDrawer({ opened, meta, onClose }: AddEmployeeDrawerProps): ReactElement {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Add employee"
      position="right"
      size="md"
      closeButtonProps={{ 'aria-label': 'Close' }}
    >
      {/* Mounted only while open, so each opening starts from an empty form. */}
      {opened && <AddEmployeeForm meta={meta} onClose={onClose} />}
    </Drawer>
  );
}
