import { describe, expect, it } from 'vitest';
import {
  type SimulatorQuery,
  parseSimulatorQuery,
  toSimulationRequest,
  toSimulatorUrlParams,
  usdRoundedToWholeDollars,
} from './simulator-query';

const EVERYONE_AT_ZERO: SimulatorQuery = {
  search: '',
  country: '',
  department: '',
  jobTitle: '',
  pct: 0,
};

function parse(queryString: string): SimulatorQuery {
  return parseSimulatorQuery(new URLSearchParams(queryString));
}

describe('parseSimulatorQuery', () => {
  it('starts with everyone and a raise of 0% when the URL says nothing', () => {
    expect(parse('')).toEqual(EVERYONE_AT_ZERO);
  });

  it('reads the filters and the percentage from the URL', () => {
    expect(
      parse('search=sharma&country=IN&department=Engineering&jobTitle=Senior%20Engineer&pct=8'),
    ).toEqual({
      search: 'sharma',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Senior Engineer',
      pct: 8,
    });
  });

  it.each([
    { url: 'pct=12.5', pct: 12.5 },
    { url: 'pct=0.1', pct: 0.1 },
    { url: 'pct=50', pct: 50 },
    { url: 'pct=0', pct: 0 },
  ])('accepts $url', ({ url, pct }) => {
    expect(parse(url).pct).toBe(pct);
  });

  it.each([
    { url: 'pct=50.1', why: 'above the maximum' },
    { url: 'pct=99', why: 'far above the maximum' },
    { url: 'pct=-5', why: 'negative' },
    { url: 'pct=8.25', why: 'more than one decimal' },
    { url: 'pct=abc', why: 'not a number' },
    { url: 'pct=', why: 'empty' },
    { url: 'pct=8%25', why: 'a number with a percent sign' },
  ])('falls back to 0% for $url ($why), as the shared schema would reject it', ({ url }) => {
    expect(parse(url).pct).toBe(0);
  });

  it('ignores the directory’s sort and page, which mean nothing here', () => {
    expect(parse('country=IN&sort=salary&order=desc&page=3')).toEqual({
      ...EVERYONE_AT_ZERO,
      country: 'IN',
    });
  });
});

describe('toSimulatorUrlParams', () => {
  it('writes nothing for everyone at 0%, so the plain address is the default view', () => {
    expect(toSimulatorUrlParams(EVERYONE_AT_ZERO)).toEqual({});
  });

  it('writes only what is set, trimming the search', () => {
    expect(
      toSimulatorUrlParams({ ...EVERYONE_AT_ZERO, search: '  sharma ', country: 'IN', pct: 12.5 }),
    ).toEqual({ search: 'sharma', country: 'IN', pct: '12.5' });
  });

  it('round-trips through the URL', () => {
    const query: SimulatorQuery = {
      search: 'sharma',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Senior Engineer',
      pct: 8,
    };

    expect(parseSimulatorQuery(new URLSearchParams(toSimulatorUrlParams(query)))).toEqual(query);
  });
});

describe('toSimulationRequest', () => {
  it('asks about everyone when no filter is set', () => {
    expect(toSimulationRequest(EVERYONE_AT_ZERO)).toEqual({ filters: {}, pct: 0 });
  });

  it('sends only the filters that are set, and the percentage as a number', () => {
    expect(
      toSimulationRequest({
        search: ' sharma ',
        country: 'IN',
        department: '',
        jobTitle: 'Engineer',
        pct: 12.5,
      }),
    ).toEqual({ filters: { search: 'sharma', country: 'IN', jobTitle: 'Engineer' }, pct: 12.5 });
  });
});

describe('usdRoundedToWholeDollars', () => {
  it.each([
    { usdMinor: 2_978_386_560, shown: 'USD 29,783,866', why: '.60 rounds up' },
    { usdMinor: 537_600, shown: 'USD 5,376', why: 'a whole amount stays as it is' },
    { usdMinor: 149, shown: 'USD 1', why: '1.49 rounds down' },
    { usdMinor: 150, shown: 'USD 2', why: '1.50 rounds up' },
    { usdMinor: 0, shown: 'USD 0', why: 'zero' },
  ])('shows $usdMinor cents as "$shown" ($why)', ({ usdMinor, shown }) => {
    expect(usdRoundedToWholeDollars(usdMinor)).toBe(shown);
  });
});
