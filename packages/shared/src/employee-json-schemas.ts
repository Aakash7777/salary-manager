import { z } from 'zod';
import {
  changeSalaryInputSchema,
  createEmployeeInputSchema,
  listEmployeesQuerySchema,
  updateEmployeeDetailsInputSchema,
} from './employee-schemas.js';
import { simulateRaiseInputSchema } from './simulation-schemas.js';

/** The parts of a JSON Schema this project reads. Anything else passes through untouched. */
export interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
  format?: string;
  description?: string;
  [keyword: string]: unknown;
}

// The date rules ("not in the future") depend on today and cannot be expressed in JSON Schema,
// so any date will do here.
const ANY_DAY = '9999-12-31';

/** Removes what is only noise in API documentation. */
function tidied(schema: JsonSchema): JsonSchema {
  const tidy: JsonSchema = { ...schema };
  delete tidy.$schema;
  if (tidy.format === 'date') {
    // zod spells out a leap-year-aware pattern; "format: date" already says it.
    delete tidy.pattern;
  }
  if (tidy.maximum === Number.MAX_SAFE_INTEGER) {
    delete tidy.maximum;
  }
  if (tidy.properties) {
    tidy.properties = Object.fromEntries(
      Object.entries(tidy.properties).map(([name, property]) => [name, tidied(property)]),
    );
  }
  return tidy;
}

function jsonSchemaOf(schema: z.ZodType): JsonSchema {
  // "input": what a caller sends, before the schema trims or lowercases it.
  return tidied(z.toJSONSchema(schema, { io: 'input' }) as JsonSchema);
}

/**
 * The request shapes as JSON Schema, generated from the same zod schemas that validate them,
 * so API documentation cannot drift from the real rules.
 */
export function employeeJsonSchemas(): Record<
  | 'CreateEmployeeInput'
  | 'UpdateEmployeeDetailsInput'
  | 'ChangeSalaryInput'
  | 'ListEmployeesQuery'
  | 'SimulateRaiseInput',
  JsonSchema
> {
  return {
    CreateEmployeeInput: jsonSchemaOf(createEmployeeInputSchema(ANY_DAY)),
    UpdateEmployeeDetailsInput: jsonSchemaOf(
      updateEmployeeDetailsInputSchema({ today: ANY_DAY, currentCountryCode: '' }),
    ),
    ChangeSalaryInput: jsonSchemaOf(changeSalaryInputSchema(ANY_DAY)),
    ListEmployeesQuery: jsonSchemaOf(listEmployeesQuerySchema),
    SimulateRaiseInput: jsonSchemaOf(simulateRaiseInputSchema),
  };
}
