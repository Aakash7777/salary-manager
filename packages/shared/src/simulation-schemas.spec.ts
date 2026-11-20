import { describe, expect, it } from 'vitest';
import { MAX_RAISE_PCT, raisePctSchema, simulateRaiseInputSchema } from './simulation-schemas.js';

interface ParseResult {
  success: boolean;
  data?: unknown;
  error?: { issues: { path: PropertyKey[]; message: string }[] };
}

interface Schema {
  safeParse(input: unknown): ParseResult;
}

function issuesOf(schema: Schema, input: unknown): string[] {
  const result = schema.safeParse(input);
  return (result.error?.issues ?? []).map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

function parsed(schema: Schema, input: unknown): unknown {
  const result = schema.safeParse(input);
  expect(issuesOf(schema, input)).toEqual([]);
  return result.data;
}

describe('raisePctSchema', () => {
  it('allows raises up to 50 percent', () => {
    expect(MAX_RAISE_PCT).toBe(50);
  });

  it.each([0, 0.1, 8, 12.5, 49.9, 50])('accepts %s percent', (pct) => {
    expect(parsed(raisePctSchema, pct)).toBe(pct);
  });

  it.each([
    { pct: 50.1, why: 'just above the maximum' },
    { pct: 51, why: 'above the maximum' },
    { pct: -0.1, why: 'just below zero' },
    { pct: -8, why: 'negative' },
  ])('rejects $pct percent ($why)', ({ pct }) => {
    expect(issuesOf(raisePctSchema, pct)).toEqual([': Raise percentage must be between 0 and 50']);
  });

  it.each([8.25, 0.05, 49.99])('rejects %s percent, which has more than one decimal', (pct) => {
    expect(issuesOf(raisePctSchema, pct)).toEqual([
      ': Raise percentage can have at most 1 decimal place',
    ]);
  });

  it('says a missing percentage is required', () => {
    expect(issuesOf(raisePctSchema, undefined)).toEqual([': Raise percentage is required']);
  });

  it.each([
    { input: '8', what: 'a string' },
    { input: null, what: 'null' },
    { input: Number.NaN, what: 'NaN' },
    { input: Number.POSITIVE_INFINITY, what: 'infinity' },
  ])('rejects $what as not a valid percentage', ({ input }) => {
    expect(issuesOf(raisePctSchema, input)).toEqual([': Enter a valid raise percentage']);
  });
});

describe('simulateRaiseInputSchema', () => {
  it('accepts a percentage with the directory’s filters', () => {
    const input = {
      filters: {
        search: 'sharma',
        country: 'IN',
        department: 'Engineering',
        jobTitle: 'Senior Engineer',
      },
      pct: 8,
    };

    expect(parsed(simulateRaiseInputSchema, input)).toMatchObject(input);
  });

  it('treats missing filters as "everyone"', () => {
    expect(parsed(simulateRaiseInputSchema, { pct: 8 })).toMatchObject({ pct: 8, filters: {} });
    expect(parsed(simulateRaiseInputSchema, { pct: 8, filters: {} })).toMatchObject({
      pct: 8,
      filters: {},
    });
  });

  it('treats blank filter values as not provided, like the directory does', () => {
    const result = parsed(simulateRaiseInputSchema, {
      filters: { search: '   ', country: '', department: '', jobTitle: '' },
      pct: 8,
    }) as { filters: Record<string, unknown> };

    expect(result.filters).not.toHaveProperty('search');
    expect(result.filters).not.toHaveProperty('country');
    expect(result.filters).not.toHaveProperty('department');
    expect(result.filters).not.toHaveProperty('jobTitle');
  });

  it('takes filters of the same shape as the list query, so sort and paging are accepted', () => {
    expect(
      issuesOf(simulateRaiseInputSchema, {
        filters: { country: 'IN', sort: 'salary', order: 'desc', page: 3, pageSize: 10 },
        pct: 8,
      }),
    ).toEqual([]);
  });

  it('reports a bad filter under "filters", with the directory’s own message', () => {
    expect(issuesOf(simulateRaiseInputSchema, { filters: { country: 'ZZ' }, pct: 8 })).toEqual([
      'filters.country: Select a supported country',
    ]);
  });

  it('reports a bad percentage under "pct"', () => {
    expect(issuesOf(simulateRaiseInputSchema, { filters: {}, pct: 50.1 })).toEqual([
      'pct: Raise percentage must be between 0 and 50',
    ]);
    expect(issuesOf(simulateRaiseInputSchema, { filters: {} })).toEqual([
      'pct: Raise percentage is required',
    ]);
  });

  it('reports a bad filter and a bad percentage together', () => {
    expect(issuesOf(simulateRaiseInputSchema, { filters: { country: 'ZZ' }, pct: -1 })).toEqual(
      expect.arrayContaining([
        'filters.country: Select a supported country',
        'pct: Raise percentage must be between 0 and 50',
      ]),
    );
  });

  it('does not accept anything else, such as a flag asking to apply the raise', () => {
    expect(issuesOf(simulateRaiseInputSchema, { pct: 8, apply: true })).toHaveLength(1);
  });
});
