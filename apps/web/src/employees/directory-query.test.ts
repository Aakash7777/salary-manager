import { describe, expect, it } from 'vitest';
import {
  type DirectoryQuery,
  exportCsvHref,
  parseDirectoryQuery,
  shownRange,
  sortedBy,
  toApiParams,
  toUrlParams,
  withoutFilters,
} from './directory-query';

const DEFAULT_QUERY: DirectoryQuery = {
  search: '',
  country: '',
  department: '',
  jobTitle: '',
  sort: 'name',
  order: 'asc',
  page: 1,
};

const FULL_QUERY: DirectoryQuery = {
  search: 'sharma',
  country: 'IN',
  department: 'Engineering',
  jobTitle: 'Senior Engineer',
  sort: 'salary',
  order: 'desc',
  page: 3,
};

function parse(queryString: string): DirectoryQuery {
  return parseDirectoryQuery(new URLSearchParams(queryString));
}

describe('parseDirectoryQuery', () => {
  it('gives the defaults for an empty URL', () => {
    expect(parse('')).toEqual(DEFAULT_QUERY);
  });

  it('reads every part of a full URL', () => {
    expect(
      parse(
        'search=sharma&country=IN&department=Engineering&jobTitle=Senior%20Engineer&sort=salary&order=desc&page=3',
      ),
    ).toEqual(FULL_QUERY);
  });

  it('decodes spaces, plus signs and special characters in values', () => {
    expect(parse('search=o%27neil%20%26%20co&jobTitle=Senior+Engineer')).toMatchObject({
      search: "o'neil & co",
      jobTitle: 'Senior Engineer',
    });
  });

  it.each(['salary', 'hireDate', 'name'])('accepts the sort column "%s"', (sort) => {
    expect(parse(`sort=${sort}`).sort).toBe(sort);
  });

  it.each(['email', 'Salary', 'hire_date', '', 'name;drop'])(
    'falls back to sorting by name for the unknown sort "%s"',
    (sort) => {
      expect(parse(`sort=${encodeURIComponent(sort)}`).sort).toBe('name');
    },
  );

  it.each(['up', 'DESC', 'descending', ''])(
    'falls back to ascending for the unknown order "%s"',
    (order) => {
      expect(parse(`order=${order}`).order).toBe('asc');
    },
  );

  it.each(['abc', '0', '-1', '1.5', '', '2abc', 'NaN', 'Infinity'])(
    'falls back to page 1 for the unusable page "%s"',
    (page) => {
      expect(parse(`page=${page}`).page).toBe(1);
    },
  );

  it('reads a large page number as it is', () => {
    expect(parse('page=400').page).toBe(400);
  });

  it('ignores parameters it does not know', () => {
    expect(parse('utm_source=email&pageSize=500&foo=bar')).toEqual(DEFAULT_QUERY);
  });

  it('uses the first value when a parameter is repeated', () => {
    expect(parse('country=IN&country=US').country).toBe('IN');
  });

  it('passes an unknown country, department or job title through unchanged, for the API to judge', () => {
    expect(parse('country=ZZ&department=Nonexistent&jobTitle=Wizard')).toMatchObject({
      country: 'ZZ',
      department: 'Nonexistent',
      jobTitle: 'Wizard',
    });
  });
});

describe('toUrlParams', () => {
  it('writes nothing at all for the default query', () => {
    expect(toUrlParams(DEFAULT_QUERY)).toEqual({});
  });

  it('writes every part of a query that differs from the defaults', () => {
    expect(toUrlParams(FULL_QUERY)).toEqual({
      search: 'sharma',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Senior Engineer',
      sort: 'salary',
      order: 'desc',
      page: '3',
    });
  });

  it.each([
    { change: { sort: 'name' }, absent: 'sort' },
    { change: { order: 'asc' }, absent: 'order' },
    { change: { page: 1 }, absent: 'page' },
    { change: { search: '' }, absent: 'search' },
    { change: { country: '' }, absent: 'country' },
    { change: { department: '' }, absent: 'department' },
    { change: { jobTitle: '' }, absent: 'jobTitle' },
  ] as const)('leaves out $absent when it is empty or the default', ({ change, absent }) => {
    expect(toUrlParams({ ...FULL_QUERY, ...change })).not.toHaveProperty(absent);
  });

  it('keeps a descending order even when the sort column is the default', () => {
    expect(toUrlParams({ ...DEFAULT_QUERY, order: 'desc' })).toEqual({ order: 'desc' });
  });

  it('trims the search text, and leaves out a search that is only spaces', () => {
    expect(toUrlParams({ ...DEFAULT_QUERY, search: '  priya ' })).toEqual({ search: 'priya' });
    expect(toUrlParams({ ...DEFAULT_QUERY, search: '   ' })).toEqual({});
  });

  it('writes the parts in a fixed order, so the same view always has the same link', () => {
    expect(Object.keys(toUrlParams(FULL_QUERY))).toEqual([
      'search',
      'country',
      'department',
      'jobTitle',
      'sort',
      'order',
      'page',
    ]);
  });

  it('reads back exactly what it wrote', () => {
    const written = new URLSearchParams(toUrlParams(FULL_QUERY));

    expect(parseDirectoryQuery(written)).toEqual(FULL_QUERY);
  });

  it('cleans a junk URL down to nothing when it is read and written back', () => {
    const junk = parse('sort=email&order=up&page=abc&search=%20%20&foo=bar');

    expect(toUrlParams(junk)).toEqual({});
  });
});

describe('toApiParams', () => {
  it('asks for 25 per page and nothing else for the default query', () => {
    expect(toApiParams(DEFAULT_QUERY)).toEqual({ pageSize: '25' });
  });

  it('sends everything in the URL plus the page size', () => {
    expect(toApiParams(FULL_QUERY)).toEqual({
      search: 'sharma',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Senior Engineer',
      sort: 'salary',
      order: 'desc',
      page: '3',
      pageSize: '25',
    });
  });

  it('never sends a blank value, which the API would treat as not provided anyway', () => {
    const params = toApiParams({ ...DEFAULT_QUERY, search: '   ' });

    expect(Object.values(params).filter((value) => value.trim() === '')).toEqual([]);
  });
});

describe('exportCsvHref', () => {
  it('is the bare export address for the default query', () => {
    expect(exportCsvHref(DEFAULT_QUERY)).toBe('/api/employees/export.csv');
  });

  it('carries search, filters and sort, but never the page', () => {
    expect(exportCsvHref(FULL_QUERY)).toBe(
      '/api/employees/export.csv?search=sharma&country=IN&department=Engineering&jobTitle=Senior+Engineer&sort=salary&order=desc',
    );
  });

  it('is the bare address when only the page differs from the defaults', () => {
    expect(exportCsvHref({ ...DEFAULT_QUERY, page: 7 })).toBe('/api/employees/export.csv');
  });

  it('encodes characters that would otherwise break the link', () => {
    const href = exportCsvHref({ ...DEFAULT_QUERY, search: "o'neil & co?", jobTitle: 'R&D Lead' });

    const params = new URLSearchParams(href.split('?')[1]);
    expect(Object.fromEntries(params)).toEqual({ search: "o'neil & co?", jobTitle: 'R&D Lead' });
    expect(href.split('?')).toHaveLength(2);
  });
});

describe('withoutFilters', () => {
  it('clears search and the three filters, returns to page 1, and keeps the sort', () => {
    expect(withoutFilters(FULL_QUERY)).toEqual({
      ...DEFAULT_QUERY,
      sort: 'salary',
      order: 'desc',
    });
  });

  it('does not change the query it is given', () => {
    const query = { ...FULL_QUERY };

    withoutFilters(query);

    expect(query).toEqual(FULL_QUERY);
  });
});

describe('sortedBy', () => {
  it.each([
    { from: 'name', order: 'asc', click: 'name', expected: { sort: 'name', order: 'desc' } },
    { from: 'name', order: 'desc', click: 'name', expected: { sort: 'name', order: 'asc' } },
    { from: 'name', order: 'asc', click: 'salary', expected: { sort: 'salary', order: 'asc' } },
    { from: 'name', order: 'desc', click: 'salary', expected: { sort: 'salary', order: 'asc' } },
    {
      from: 'salary',
      order: 'desc',
      click: 'hireDate',
      expected: { sort: 'hireDate', order: 'asc' },
    },
  ] as const)(
    'from $from $order, clicking $click gives $expected.sort $expected.order',
    ({ from, order, click, expected }) => {
      expect(sortedBy({ ...DEFAULT_QUERY, sort: from, order }, click)).toEqual(expected);
    },
  );
});

describe('shownRange', () => {
  it.each([
    { page: 1, total: 1_240, range: { from: 1, to: 25 }, why: 'the first full page' },
    { page: 2, total: 1_240, range: { from: 26, to: 50 }, why: 'the second full page' },
    { page: 50, total: 1_240, range: { from: 1_226, to: 1_240 }, why: 'a partial last page' },
    { page: 1, total: 7, range: { from: 1, to: 7 }, why: 'fewer rows than one page' },
    { page: 4, total: 100, range: { from: 76, to: 100 }, why: 'a last page that is exactly full' },
  ])('is $range.from to $range.to on page $page of $total ($why)', ({ page, total, range }) => {
    expect(shownRange(page, 25, total)).toEqual(range);
  });
});
