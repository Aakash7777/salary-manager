import { describe, expect, it } from 'vitest';
import { changedFields, isCountryChange } from './employee-details.js';

const current = {
  fullName: 'Priya Sharma',
  email: 'priya.sharma@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  employmentType: 'FULL_TIME',
  hireDate: '2024-03-01',
};

describe('changedFields', () => {
  it('returns nothing when nothing is proposed', () => {
    expect(changedFields(current, {})).toEqual({});
  });

  it('returns nothing when every proposed field equals the current value', () => {
    expect(changedFields(current, { ...current })).toEqual({});
  });

  it('returns a field whose proposed value differs', () => {
    expect(changedFields(current, { jobTitle: 'Staff Engineer' })).toEqual({
      jobTitle: 'Staff Engineer',
    });
  });

  it('returns only the differing fields from a mix of changed and unchanged ones', () => {
    const proposed = { ...current, jobTitle: 'Staff Engineer', department: 'Platform' };

    expect(changedFields(current, proposed)).toEqual({
      jobTitle: 'Staff Engineer',
      department: 'Platform',
    });
  });

  it('ignores a field that is present but undefined', () => {
    expect(changedFields(current, { jobTitle: undefined, department: 'Platform' })).toEqual({
      department: 'Platform',
    });
  });

  it('treats values that differ only by letter case as changed', () => {
    expect(changedFields(current, { department: 'engineering' })).toEqual({
      department: 'engineering',
    });
  });

  it('does not modify either argument', () => {
    const proposed = { jobTitle: 'Staff Engineer' };

    changedFields(current, proposed);

    expect(current.jobTitle).toBe('Senior Engineer');
    expect(proposed).toEqual({ jobTitle: 'Staff Engineer' });
  });
});

describe('isCountryChange', () => {
  it('is false when no country is proposed', () => {
    expect(isCountryChange('IN', undefined)).toBe(false);
  });

  it('is false when the proposed country is the current one', () => {
    expect(isCountryChange('IN', 'IN')).toBe(false);
  });

  it('is true when the proposed country is a different one', () => {
    expect(isCountryChange('IN', 'DE')).toBe(true);
  });
});
