import { describe, expect, it } from 'vitest';
import { changedDetails, fieldErrorsFrom, localIsoDate, withoutBlanks } from './form-input';

describe('localIsoDate', () => {
  it('gives the calendar date on the user’s own clock', () => {
    expect(localIsoDate(new Date(2026, 10, 19, 12, 0, 0))).toBe('2026-11-19');
  });

  it('pads single-digit months and days', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 9, 30, 0))).toBe('2026-01-05');
  });

  it.each([
    { time: [0, 0, 0], why: 'the first second of the day' },
    { time: [23, 59, 59], why: 'the last second of the day' },
  ])('stays on the same local day at $why', ({ time }) => {
    const [hours = 0, minutes = 0, seconds = 0] = time;

    expect(localIsoDate(new Date(2026, 10, 19, hours, minutes, seconds))).toBe('2026-11-19');
  });
});

describe('withoutBlanks', () => {
  it('drops empty and whitespace-only text, null and undefined, so "required" messages apply', () => {
    expect(
      withoutBlanks({ fullName: '', email: '   ', jobTitle: null, department: undefined }),
    ).toEqual({});
  });

  it('keeps real values as they are, including zero and text with spaces around it', () => {
    expect(withoutBlanks({ fullName: ' Priya ', salaryMajor: 0, countryCode: 'IN' })).toEqual({
      fullName: ' Priya ',
      salaryMajor: 0,
      countryCode: 'IN',
    });
  });
});

describe('fieldErrorsFrom', () => {
  it('maps each issue to its field', () => {
    expect(
      fieldErrorsFrom([
        { path: 'email', message: 'Enter a valid email address' },
        { path: 'salaryMajor', message: 'Salary must be greater than 0' },
      ]),
    ).toEqual({
      email: 'Enter a valid email address',
      salaryMajor: 'Salary must be greater than 0',
    });
  });

  it('keeps the first message when a field has several', () => {
    expect(
      fieldErrorsFrom([
        { path: 'reason', message: 'Reason is required' },
        { path: 'reason', message: 'Reason must be at least 3 characters' },
      ]),
    ).toEqual({ reason: 'Reason is required' });
  });

  it('returns nothing for no issues', () => {
    expect(fieldErrorsFrom([])).toEqual({});
  });
});

describe('changedDetails', () => {
  const original = {
    fullName: 'Priya Sharma',
    email: 'priya.sharma@acme.test',
    jobTitle: 'Senior Engineer',
    department: 'Engineering',
    countryCode: 'IN',
    employmentType: 'FULL_TIME',
    hireDate: '2021-03-12',
  };

  it('returns nothing when the form still holds the original values', () => {
    expect(changedDetails(original, { ...original })).toEqual({});
  });

  it('returns only the fields whose value differs', () => {
    expect(
      changedDetails(original, { ...original, jobTitle: 'Staff Engineer', department: 'Platform' }),
    ).toEqual({ jobTitle: 'Staff Engineer', department: 'Platform' });
  });

  it('ignores spaces around text and the letter case of an email, as the server would', () => {
    expect(
      changedDetails(original, {
        ...original,
        fullName: '  Priya Sharma ',
        email: 'Priya.Sharma@ACME.test',
      }),
    ).toEqual({});
  });

  it('reports a field that was emptied, so the "required" message can show', () => {
    expect(changedDetails(original, { ...original, jobTitle: '' })).toEqual({ jobTitle: '' });
  });
});
