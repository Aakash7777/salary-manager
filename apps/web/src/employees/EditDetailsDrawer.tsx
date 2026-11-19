import { Alert, Button, Drawer, Group, Stack, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { currencyFor, updateEmployeeDetailsInputSchema } from '@salary-manager/shared';
import { IconInfoCircle } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { type EmployeeDetail, type Meta, api } from '../api/client';
import { EmployeeDetailFields, SalaryInput } from './form-fields';
import {
  EMPTY_EMPLOYEE_FORM,
  type EmployeeFormValues,
  changedDetails,
  detailValuesOf,
  localIsoDate,
  withoutBlanks,
} from './form-input';
import { notifySaved, showSchemaIssues, showServerError } from './save-feedback';

interface EditDetailsDrawerProps {
  opened: boolean;
  employee: EmployeeDetail;
  meta: Meta | undefined;
  onClose: () => void;
}

function EditDetailsForm({
  employee,
  meta,
  onClose,
}: Omit<EditDetailsDrawerProps, 'opened'>): ReactElement {
  const queryClient = useQueryClient();
  const original = detailValuesOf(employee);
  const form = useForm<EmployeeFormValues>({
    mode: 'controlled',
    initialValues: { ...EMPTY_EMPLOYEE_FORM, ...original },
  });

  const changed = changedDetails(original, detailValuesOf(form.values));
  const countryChanges = changed.countryCode !== undefined && changed.countryCode !== '';

  const save = useMutation({
    mutationFn: (body: unknown) => api.updateEmployee(employee.id, body),
    onSuccess: async () => {
      onClose();
      notifySaved('Details updated', `${employee.fullName}'s details were saved.`);
      await queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
      await queryClient.invalidateQueries({ queryKey: ['meta'] });
    },
    onError: (error) => {
      showServerError(form, error);
    },
  });

  const submit = (): void => {
    // Only what changed is sent. The new salary and reason go along only with a new country.
    const input = {
      ...changed,
      ...(countryChanges
        ? withoutBlanks({
            newSalaryMajor: form.values.newSalaryMajor,
            reason: form.values.reason,
          })
        : {}),
    };
    const parsed = updateEmployeeDetailsInputSchema({
      today: localIsoDate(new Date()),
      currentCountryCode: employee.countryCode,
    }).safeParse(input);
    if (!parsed.success) {
      showSchemaIssues(form, parsed.error.issues);
      return;
    }
    form.clearErrors();
    save.mutate(parsed.data);
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
        {countryChanges && (
          <>
            <SalaryInput
              label="New annual salary"
              currency={currencyFor(form.values.countryCode)}
              value={form.values.newSalaryMajor}
              onChange={(value) => {
                form.setFieldValue('newSalaryMajor', value);
              }}
              error={form.errors.newSalaryMajor}
            />
            <Textarea label="Reason" rows={3} {...form.getInputProps('reason')} />
          </>
        )}
        <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} aria-hidden />}>
          To change the salary, use Change salary.
        </Alert>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={save.isPending}
            disabled={Object.keys(changed).length === 0}
          >
            Save changes
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function EditDetailsDrawer({
  opened,
  employee,
  meta,
  onClose,
}: EditDetailsDrawerProps): ReactElement {
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title="Edit details"
      position="right"
      size="md"
      closeButtonProps={{ 'aria-label': 'Close' }}
    >
      {/* Mounted only while open, so each opening starts from the stored details. */}
      {opened && <EditDetailsForm employee={employee} meta={meta} onClose={onClose} />}
    </Drawer>
  );
}
