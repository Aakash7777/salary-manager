import {
  EMPLOYMENT_TYPES,
  FX_TABLE_VERSION,
  type JsonSchema,
  employeeJsonSchemas,
  listCountries,
} from '@salary-manager/shared';

type Schema = JsonSchema | { $ref: string };

const ref = (name: string): { $ref: string } => ({ $ref: `#/components/schemas/${name}` });
const errorResponse = (name: string): { $ref: string } => ({
  $ref: `#/components/responses/${name}`,
});
const json = (description: string, schema: Schema) => ({
  description,
  content: { 'application/json': { schema } },
});
const body = (schemaName: string) => ({
  required: true,
  content: { 'application/json': { schema: ref(schemaName) } },
});

const integer: JsonSchema = { type: 'integer' };
const text: JsonSchema = { type: 'string' };
const minorUnits = (description: string): JsonSchema => ({ type: 'integer', description });

function object(properties: Record<string, Schema>, optional: string[] = []): JsonSchema {
  return {
    type: 'object',
    properties: properties,
    required: Object.keys(properties).filter((name) => !optional.includes(name)),
  };
}

const QUERY_DESCRIPTIONS: Record<string, string> = {
  search: 'Matches part of the full name or email, ignoring case.',
  country: 'ISO country code, exact match.',
  department: 'Exact match.',
  jobTitle: 'Exact match.',
  sort: 'Sorting by salary compares raw amounts; currencies are not converted.',
  order: 'Ties are always broken by lowest id first.',
  page: 'Ignored by the CSV export.',
  pageSize: 'Ignored by the CSV export.',
};

const PAY_STATS = {
  headcount: integer,
  minMinor: minorUnits('Lowest salary, in minor units of the local currency.'),
  medianMinor: minorUnits('Median salary. An even count gives the mean of the middle two.'),
  avgMinor: minorUnits('Average salary, rounded half up.'),
  maxMinor: minorUnits('Highest salary.'),
};

const COUNTRY_REF = {
  code: { type: 'string', enum: listCountries().map((country) => country.code) },
  name: text,
  currency: { type: 'string', description: 'ISO 4217 code, set by the country.' },
};

const idParameter = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'integer', minimum: 0 },
  description: 'Employee id.',
};

function queryParameters(listQuery: JsonSchema, names: string[]) {
  return names.map((name) => ({
    name,
    in: 'query',
    required: false,
    schema: listQuery.properties?.[name] ?? {},
    description: QUERY_DESCRIPTIONS[name],
  }));
}

/** The OpenAPI 3.1 description of this API. Request shapes come from the shared zod schemas. */
export function buildOpenApiDocument(): Record<string, unknown> {
  const requestSchemas = employeeJsonSchemas();
  const filterNames = ['search', 'country', 'department', 'jobTitle', 'sort', 'order'];
  const listParameters = queryParameters(requestSchemas.ListEmployeesQuery, [
    ...filterNames,
    'page',
    'pageSize',
  ]);
  const exportParameters = queryParameters(requestSchemas.ListEmployeesQuery, filterNames);

  const employee = object({
    id: integer,
    fullName: text,
    email: text,
    jobTitle: text,
    department: text,
    countryCode: COUNTRY_REF.code,
    currency: COUNTRY_REF.currency,
    salaryMinor: minorUnits(
      'Annual gross base salary as an integer in minor units of `currency` (paise, cents). Never a decimal.',
    ),
    employmentType: { type: 'string', enum: [...EMPLOYMENT_TYPES] },
    hireDate: { type: 'string', format: 'date' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  });

  const serverError = errorResponse('InternalError');
  const invalid = errorResponse('InvalidInput');
  const notFound = errorResponse('EmployeeNotFound');
  const emailInUse = errorResponse('EmailInUse');

  return {
    openapi: '3.1.0',
    info: {
      title: 'ACME Salary Manager API',
      version: '1.0.0',
      description: [
        'Manage employees and their salaries, and see how pay compares by country and role.',
        '',
        '**Money** is always an integer in minor units plus an ISO 4217 currency, never a decimal. The currency is derived from the country and is never an input.',
        '',
        '**Errors** always have the shape `{ "error": { "code", "message", "fields"? } }`.',
        '',
        '**Dates** are `YYYY-MM-DD`. "Not in the future" is judged against the latest calendar date anywhere on Earth (UTC+14), so no user is told their own today is in the future.',
      ].join('\n'),
    },
    tags: [
      { name: 'Employees' },
      {
        name: 'Insights',
        description: 'Pay statistics. Per-country figures are in local currency.',
      },
      { name: 'System' },
    ],
    paths: {
      '/api/employees': {
        get: {
          tags: ['Employees'],
          summary: 'List employees',
          description: 'Search, filter, sort and page through the directory.',
          parameters: listParameters,
          responses: {
            200: json('One page of employees, with the total that match.', ref('EmployeePage')),
            400: invalid,
            500: serverError,
          },
        },
        post: {
          tags: ['Employees'],
          summary: 'Create an employee',
          description:
            'Also writes the first salary-history entry, "Starting salary", in the same transaction.',
          requestBody: body('CreateEmployeeInput'),
          responses: {
            201: json('The created employee.', ref('Employee')),
            400: invalid,
            409: emailInUse,
            500: serverError,
          },
        },
      },
      '/api/employees/export.csv': {
        get: {
          tags: ['Employees'],
          summary: 'Export employees as CSV',
          description:
            'Every employee matching the same search, filters and sort as the list, without paging. UTF-8 with a byte order mark; cells that could be read as spreadsheet formulas are prefixed with a single quote.',
          parameters: exportParameters,
          responses: {
            200: {
              description: 'A CSV file download.',
              content: { 'text/csv': { schema: text } },
            },
            400: invalid,
            500: serverError,
          },
        },
      },
      '/api/employees/{id}': {
        get: {
          tags: ['Employees'],
          summary: 'Get one employee',
          description:
            'With their salary history, newest first, and the median for their job title in their country.',
          parameters: [idParameter],
          responses: {
            200: json('The employee.', ref('EmployeeDetail')),
            400: invalid,
            404: notFound,
            500: serverError,
          },
        },
        patch: {
          tags: ['Employees'],
          summary: 'Update an employee’s details',
          description:
            'Send only the fields to change. Salary cannot be changed here, except when `countryCode` changes: then `newSalaryMajor` (in the new currency) and `reason` are required, and the change is recorded in the salary history.',
          parameters: [idParameter],
          requestBody: body('UpdateEmployeeDetailsInput'),
          responses: {
            200: json('The updated employee.', ref('Employee')),
            400: invalid,
            404: notFound,
            409: emailInUse,
            500: serverError,
          },
        },
        delete: {
          tags: ['Employees'],
          summary: 'Remove an employee',
          description: 'Deletes the employee and their salary history. This cannot be undone.',
          parameters: [idParameter],
          responses: {
            204: { description: 'Removed. No content.' },
            400: invalid,
            404: notFound,
            500: serverError,
          },
        },
      },
      '/api/employees/{id}/salary-changes': {
        post: {
          tags: ['Employees'],
          summary: 'Change an employee’s salary',
          description:
            'Updates the salary and records the old and new amount, effective date and reason in one transaction. The effective date cannot be in the future or before the hire date, and the new salary must differ from the current one.',
          parameters: [idParameter],
          requestBody: body('ChangeSalaryInput'),
          responses: {
            201: json('The employee with the new salary.', ref('Employee')),
            400: invalid,
            404: notFound,
            500: serverError,
          },
        },
      },
      '/api/meta': {
        get: {
          tags: ['Employees'],
          summary: 'Choices for filters and forms',
          description:
            'The supported countries, and the departments and job titles currently in use.',
          responses: { 200: json('The choices.', ref('Meta')), 500: serverError },
        },
      },
      '/api/insights/summary': {
        get: {
          tags: ['Insights'],
          summary: 'Organisation-wide summary',
          description: `Headcount and total annual payroll in USD. The payroll is **indicative**: each country's total is converted with the fixed FX table (currently \`${FX_TABLE_VERSION}\`) and only then added. Amounts in different currencies are never summed directly.`,
          responses: { 200: json('The summary.', ref('InsightsSummary')), 500: serverError },
        },
      },
      '/api/insights/countries': {
        get: {
          tags: ['Insights'],
          summary: 'Pay statistics per country',
          description:
            'One row per country that has employees, largest headcount first. Each row is in that country’s own currency.',
          responses: {
            200: json('The countries.', { type: 'array', items: ref('CountryPay') }),
            500: serverError,
          },
        },
      },
      '/api/insights/countries/{code}/job-titles': {
        get: {
          tags: ['Insights'],
          summary: 'Pay per job title in one country, and its outliers',
          description:
            'Job titles with the highest median first. Outliers are employees paid more than 25% above or below the median for their job title in this country, largest gap first.',
          parameters: [
            {
              name: 'code',
              in: 'path',
              required: true,
              schema: COUNTRY_REF.code,
              description: 'ISO country code, exact (upper case).',
            },
          ],
          responses: {
            200: json('The job titles and outliers.', ref('CountryJobTitles')),
            400: invalid,
            500: serverError,
          },
        },
      },
      '/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          description: 'Runs a real query against the database.',
          responses: {
            200: json('The app and its database are working.', ref('HealthReport')),
            503: json('The database could not be queried.', ref('HealthReport')),
            500: serverError,
          },
        },
      },
    },
    components: {
      schemas: {
        ...requestSchemas,
        Employee: employee,
        SalaryChange: object({
          id: integer,
          employeeId: integer,
          oldSalaryMinor: {
            type: ['integer', 'null'],
            description: 'Null on the "Starting salary" entry.',
          },
          oldCurrency: {
            type: ['string', 'null'],
            description:
              'Null on the "Starting salary" entry. Differs from `currency` only when the change came from a country change.',
          },
          newSalaryMinor: integer,
          currency: text,
          effectiveDate: { type: 'string', format: 'date' },
          reason: text,
          createdAt: { type: 'string', format: 'date-time' },
        }),
        EmployeeDetail: {
          allOf: [
            ref('Employee'),
            object({
              salaryHistory: {
                type: 'array',
                items: ref('SalaryChange'),
                description: 'Newest first.',
              },
              roleMedianMinor: {
                type: ['integer', 'null'],
                description:
                  'Median salary for the same job title in the same country. Null when the employee is the only one in the role.',
              },
              pctVsRoleMedian: {
                type: ['number', 'null'],
                description: 'Signed percentage against the role median, to one decimal place.',
              },
            }),
          ],
        },
        EmployeePage: object({
          items: { type: 'array', items: ref('Employee') },
          total: { type: 'integer', description: 'How many employees match, across all pages.' },
          page: integer,
          pageSize: integer,
        }),
        Meta: object({
          countries: { type: 'array', items: object(COUNTRY_REF) },
          departments: { type: 'array', items: text },
          jobTitles: { type: 'array', items: text },
        }),
        InsightsSummary: object({
          headcount: integer,
          countryCount: integer,
          departmentCount: integer,
          jobTitleCount: integer,
          payrollUsdMinor: minorUnits(
            'Indicative total annual payroll in USD cents, converted with the fixed FX table.',
          ),
          fxTableVersion: text,
        }),
        CountryPay: object({ ...COUNTRY_REF, ...PAY_STATS }),
        JobTitlePay: object({ jobTitle: text, ...PAY_STATS }),
        PayOutlier: object({
          employeeId: integer,
          fullName: text,
          jobTitle: text,
          salaryMinor: integer,
          roleMedianMinor: integer,
          differencePct: {
            type: 'number',
            description: 'Signed: positive above the role median, negative below.',
          },
          direction: { type: 'string', enum: ['above', 'below'] },
        }),
        CountryJobTitles: object({
          country: object(COUNTRY_REF),
          jobTitles: { type: 'array', items: ref('JobTitlePay') },
          outliers: { type: 'array', items: ref('PayOutlier') },
        }),
        HealthReport: object({
          status: { type: 'string', enum: ['ok', 'error'] },
          db: { type: 'string', enum: ['ok', 'error'] },
        }),
        Error: object({
          error: object(
            {
              code: {
                type: 'string',
                description:
                  'For example INVALID_INPUT, EMPLOYEE_NOT_FOUND, EMAIL_ALREADY_IN_USE, NOT_FOUND, INTERNAL_ERROR.',
              },
              message: text,
              fields: {
                type: 'array',
                description:
                  'Present for INVALID_INPUT: one entry per problem, for showing under inputs.',
                items: object({
                  path: { type: 'string', description: 'The field name, such as `email`.' },
                  message: text,
                }),
              },
            },
            ['fields'],
          ),
        }),
      },
      responses: {
        InvalidInput: json(
          'The input is invalid. `error.fields` lists each problem.',
          ref('Error'),
        ),
        EmployeeNotFound: json('No employee has this id.', ref('Error')),
        EmailInUse: json('Another employee already has this email.', ref('Error')),
        InternalError: json(
          'Something went wrong on the server. The message is generic; details are in the server log.',
          ref('Error'),
        ),
      },
    },
  };
}
