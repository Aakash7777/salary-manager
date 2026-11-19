import { Button, Group, Modal, Stack, Text, Textarea } from '@mantine/core';
import { useForm } from '@mantine/form';
import { changeSalaryInputSchema, formatMoney, toMinor } from '@salary-manager/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { type EmployeeDetail, api } from '../api/client';
import { PastDateInput, SalaryInput } from './form-fields';
import { localIsoDate, withoutBlanks } from './form-input';
import { describeSalaryChange } from './salary-preview';
import { notifySaved, showSchemaIssues, showServerError } from './save-feedback';

interface ChangeSalaryModalProps {
  opened: boolean;
  employee: EmployeeDetail;
  onClose: () => void;
}

interface ChangeSalaryValues {
  newSalaryMajor: number | string;
  effectiveDate: string | null;
  reason: string;
}

/** The preview for what has been typed so far, or null while it is not yet a usable amount. */
function previewOf(typed: number | string, employee: EmployeeDetail): string | null {
  if (typed === '') {
    return null;
  }
  try {
    const newMinor = toMinor(typed, employee.currency);
    return describeSalaryChange(employee.salaryMinor, newMinor, employee.currency);
  } catch {
    return null;
  }
}

function ChangeSalaryForm({
  employee,
  onClose,
}: Omit<ChangeSalaryModalProps, 'opened'>): ReactElement {
  const queryClient = useQueryClient();
  const form = useForm<ChangeSalaryValues>({
    mode: 'controlled',
    initialValues: { newSalaryMajor: '', effectiveDate: localIsoDate(new Date()), reason: '' },
  });
  const preview = previewOf(form.values.newSalaryMajor, employee);

  const save = useMutation({
    mutationFn: (body: unknown) => api.changeSalary(employee.id, body),
    onSuccess: async () => {
      onClose();
      notifySaved('Salary updated', `${employee.fullName}'s new salary was saved.`);
      await queryClient.invalidateQueries({ queryKey: ['employee', employee.id] });
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (error) => {
      showServerError(form, error);
    },
  });

  const submit = (): void => {
    const parsed = changeSalaryInputSchema(localIsoDate(new Date())).safeParse(
      withoutBlanks({ ...form.values }),
    );
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
        <Text c="dimmed">
          {`Current salary: ${formatMoney(employee.salaryMinor, employee.currency)}`}
        </Text>
        <SalaryInput
          label="New annual salary"
          currency={employee.currency}
          value={form.values.newSalaryMajor}
          onChange={(value) => {
            form.setFieldValue('newSalaryMajor', value);
          }}
          error={form.errors.newSalaryMajor}
        />
        <Text size="sm" fw={500} mih={20} aria-live="polite">
          {preview}
        </Text>
        <PastDateInput
          label="Effective date"
          value={form.values.effectiveDate}
          onChange={(value) => {
            form.setFieldValue('effectiveDate', value);
          }}
          error={form.errors.effectiveDate}
          notBefore={employee.hireDate}
        />
        <Textarea label="Reason" rows={3} {...form.getInputProps('reason')} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Update salary
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

export function ChangeSalaryModal({
  opened,
  employee,
  onClose,
}: ChangeSalaryModalProps): ReactElement {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Change salary"
      centered
      closeButtonProps={{ 'aria-label': 'Close' }}
    >
      {opened && <ChangeSalaryForm employee={employee} onClose={onClose} />}
    </Modal>
  );
}
