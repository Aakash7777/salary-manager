import {
  Autocomplete,
  Input,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { UseFormReturnType } from '@mantine/form';
import { listCountries } from '@salary-manager/shared';
import type { ReactElement, ReactNode } from 'react';
import type { Meta } from '../api/client';
import { type EmployeeFormValues, localIsoDate } from './form-input';

const COUNTRY_OPTIONS = listCountries().map((country) => ({
  value: country.code,
  label: country.name,
}));

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'FULL_TIME', label: 'Full-time' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CONTRACTOR', label: 'Contractor' },
];

const DATE_FORMAT = 'D MMM YYYY';

interface SalaryInputProps {
  label: string;
  /** Shown in front of the amount. Empty until a country is chosen. */
  currency: string;
  value: number | string;
  onChange: (value: number | string) => void;
  error?: ReactNode;
}

export function SalaryInput({
  label,
  currency,
  value,
  onChange,
  error,
}: SalaryInputProps): ReactElement {
  return (
    <NumberInput
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      hideControls
      allowNegative={false}
      decimalScale={2}
      thousandSeparator=","
      // Indian amounts are read in lakhs and crores: 32,40,000.
      thousandsGroupStyle={currency === 'INR' ? 'lakh' : 'thousand'}
      leftSectionWidth={52}
      leftSection={
        currency === '' ? undefined : (
          <Text size="sm" c="dimmed" aria-label="Salary currency">
            {currency}
          </Text>
        )
      }
    />
  );
}

interface PastDateInputProps {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  error?: ReactNode;
  /** Earlier days cannot be picked from the calendar. */
  notBefore?: string;
}

/**
 * A date that cannot be in the future. The calendar greys out the days that are not allowed;
 * a date typed by hand is checked by the shared schema when the form is submitted.
 */
export function PastDateInput({
  label,
  value,
  onChange,
  error,
  notBefore,
}: PastDateInputProps): ReactElement {
  const today = localIsoDate(new Date());
  return (
    <DateInput
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      valueFormat={DATE_FORMAT}
      placeholder="e.g. 12 Mar 2021"
      clearable
      clearButtonProps={{ 'aria-label': `Clear ${label.toLowerCase()}` }}
      getDayProps={(day) => ({
        disabled: day > today || (notBefore !== undefined && day < notBefore),
      })}
    />
  );
}

interface EmployeeDetailFieldsProps {
  form: UseFormReturnType<EmployeeFormValues>;
  meta: Meta | undefined;
}

/** The fields that "Add employee" and "Edit details" have in common. */
export function EmployeeDetailFields({ form, meta }: EmployeeDetailFieldsProps): ReactElement {
  return (
    <Stack gap="md">
      <TextInput label="Full name" {...form.getInputProps('fullName')} />
      <TextInput label="Email" {...form.getInputProps('email')} />
      <Autocomplete
        label="Job title"
        data={meta?.jobTitles ?? []}
        {...form.getInputProps('jobTitle')}
      />
      <Autocomplete
        label="Department"
        data={meta?.departments ?? []}
        {...form.getInputProps('department')}
      />
      <Select
        label="Country"
        data={COUNTRY_OPTIONS}
        searchable
        allowDeselect={false}
        value={form.values.countryCode === '' ? null : form.values.countryCode}
        onChange={(value) => {
          form.setFieldValue('countryCode', value ?? '');
        }}
        error={form.errors.countryCode}
      />
      <Input.Wrapper label="Employment type" error={form.errors.employmentType}>
        <SegmentedControl
          fullWidth
          aria-label="Employment type"
          data={EMPLOYMENT_TYPE_OPTIONS}
          value={form.values.employmentType}
          onChange={(value) => {
            form.setFieldValue('employmentType', value);
          }}
        />
      </Input.Wrapper>
      <PastDateInput
        label="Hire date"
        value={form.values.hireDate}
        onChange={(value) => {
          form.setFieldValue('hireDate', value);
        }}
        error={form.errors.hireDate}
      />
    </Stack>
  );
}
