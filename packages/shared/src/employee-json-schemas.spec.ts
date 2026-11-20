import { describe, expect, it } from 'vitest';
import { employeeJsonSchemas } from './employee-json-schemas.js';

describe('employeeJsonSchemas', () => {
  const schemas = employeeJsonSchemas();

  it('describes the create input with all eight fields required and no others allowed', () => {
    expect(schemas.CreateEmployeeInput).toMatchObject({
      type: 'object',
      required: [
        'fullName',
        'email',
        'jobTitle',
        'department',
        'countryCode',
        'salaryMajor',
        'employmentType',
        'hireDate',
      ],
      additionalProperties: false,
    });
    expect(Object.keys(schemas.CreateEmployeeInput.properties ?? {})).not.toContain('currency');
  });

  it('carries the field rules of the zod schemas into the JSON Schema', () => {
    const { properties = {} } = schemas.CreateEmployeeInput;

    expect(properties.fullName).toEqual({ type: 'string', minLength: 1, maxLength: 200 });
    expect(properties.email).toMatchObject({ type: 'string', maxLength: 254 });
    expect(properties.salaryMajor).toEqual({ type: 'number' });
    expect(properties.employmentType).toEqual({
      type: 'string',
      enum: ['FULL_TIME', 'PART_TIME', 'CONTRACTOR'],
    });
    expect(properties.hireDate).toEqual({ type: 'string', format: 'date' });
  });

  it('describes the update input with every field optional, including the country-change extras', () => {
    expect(schemas.UpdateEmployeeDetailsInput.required).toBeUndefined();
    expect(Object.keys(schemas.UpdateEmployeeDetailsInput.properties ?? {})).toEqual([
      'fullName',
      'email',
      'jobTitle',
      'department',
      'countryCode',
      'employmentType',
      'hireDate',
      'newSalaryMajor',
      'reason',
    ]);
    expect(schemas.UpdateEmployeeDetailsInput.additionalProperties).toBe(false);
  });

  it('describes the salary change input with its three required fields and the reason length', () => {
    expect(schemas.ChangeSalaryInput.required).toEqual([
      'newSalaryMajor',
      'effectiveDate',
      'reason',
    ]);
    expect(schemas.ChangeSalaryInput.properties?.reason).toEqual({
      type: 'string',
      minLength: 3,
      maxLength: 500,
    });
  });

  it('describes the list query with its allowed values and defaults', () => {
    const { properties = {} } = schemas.ListEmployeesQuery;

    expect(Object.keys(properties)).toEqual([
      'search',
      'country',
      'department',
      'jobTitle',
      'sort',
      'order',
      'page',
      'pageSize',
    ]);
    expect(properties.sort).toMatchObject({
      enum: ['name', 'salary', 'hireDate'],
      default: 'name',
    });
    expect(properties.order).toMatchObject({ enum: ['asc', 'desc'], default: 'asc' });
    expect(properties.page).toMatchObject({ type: 'integer', minimum: 1, default: 1 });
    expect(properties.pageSize).toMatchObject({
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 25,
    });
  });

  it('describes the raise simulation input: a required percentage from 0 to 50 and optional filters', () => {
    const { properties = {}, required, additionalProperties } = schemas.SimulateRaiseInput;

    expect(required).toEqual(['pct']);
    expect(additionalProperties).toBe(false);
    expect(properties.pct).toMatchObject({ type: 'number', minimum: 0, maximum: 50 });
    expect(Object.keys(properties.filters?.properties ?? {})).toEqual(
      expect.arrayContaining(['search', 'country', 'department', 'jobTitle']),
    );
  });

  it('leaves out what an OpenAPI document does not want: the $schema marker and long date patterns', () => {
    const text = JSON.stringify(schemas);

    expect(text).not.toContain('$schema');
    expect(text).not.toContain('pattern');
  });
});
