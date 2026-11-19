import { describe, expect, it } from 'vitest';
import {
  EMPLOYEE_CSV_HEADER_LINE,
  csvCell,
  csvLine,
  employeeCsvLine,
  majorUnitsText,
} from './csv.js';

const priya = {
  fullName: 'Priya Sharma',
  email: 'priya.sharma@acme.test',
  jobTitle: 'Senior Engineer',
  department: 'Engineering',
  countryCode: 'IN',
  currency: 'INR',
  salaryMinor: 324_000_000,
  employmentType: 'FULL_TIME',
  hireDate: '2024-03-01',
};

describe('csvCell', () => {
  it.each([
    { value: 'Priya Sharma', cell: 'Priya Sharma', why: 'plain text is left alone' },
    { value: '', cell: '', why: 'an empty value stays empty' },
    { value: "Brian O'Neil", cell: "Brian O'Neil", why: 'an apostrophe needs no escaping' },
    { value: ' padded ', cell: ' padded ', why: 'spaces are kept' },
    { value: 'Sharma, Priya', cell: '"Sharma, Priya"', why: 'a comma forces quotes' },
    {
      value: 'Dwayne "The Rock" Johnson',
      cell: '"Dwayne ""The Rock"" Johnson"',
      why: 'a double quote is doubled and the cell quoted',
    },
    { value: 'line one\nline two', cell: '"line one\nline two"', why: 'a newline forces quotes' },
    { value: 'line one\r\nline two', cell: '"line one\r\nline two"', why: 'so does CRLF' },
    { value: '"', cell: '""""', why: 'a lone quote becomes four' },
  ])('escapes $value as $cell ($why)', ({ value, cell }) => {
    expect(csvCell(value)).toBe(cell);
  });

  it.each([
    { value: '=1+1', cell: "'=1+1" },
    { value: '+91 98765 43210', cell: "'+91 98765 43210" },
    { value: '-2+3', cell: "'-2+3" },
    { value: '@SUM(A1:A9)', cell: "'@SUM(A1:A9)" },
  ])('prefixes $value with a single quote so a spreadsheet cannot run it', ({ value, cell }) => {
    expect(csvCell(value)).toBe(cell);
  });

  it.each(['a=b', 'Jean-Luc Picard', 'priya@acme.test', 'C++ Engineer'])(
    'leaves "%s" alone, because the risky character is not the first one',
    (value) => {
      expect(csvCell(value)).toBe(value);
    },
  );

  it('both prefixes and quotes a formula that also contains commas and quotes', () => {
    expect(csvCell('=HYPERLINK("http://evil.test","Click")')).toBe(
      '"\'=HYPERLINK(""http://evil.test"",""Click"")"',
    );
  });
});

describe('csvLine', () => {
  it('joins escaped cells with commas and ends the line with CRLF', () => {
    expect(csvLine(['a', 'b,c', 'd "e"', '=f'])).toBe('a,"b,c","d ""e""",\'=f\r\n');
  });

  it('keeps empty cells in place', () => {
    expect(csvLine(['a', '', 'c'])).toBe('a,,c\r\n');
  });
});

describe('majorUnitsText', () => {
  it.each([
    { amountMinor: 324_000_000, text: '3240000', why: 'a whole amount has no decimals' },
    { amountMinor: 7_500_035, text: '75000.35', why: 'cents are shown' },
    { amountMinor: 7_500_030, text: '75000.30', why: 'a trailing zero is kept' },
    { amountMinor: 5, text: '0.05', why: 'less than one unit keeps its leading zero' },
    { amountMinor: 100, text: '1', why: 'exactly one unit' },
    { amountMinor: 0, text: '0', why: 'zero' },
    {
      amountMinor: Number.MAX_SAFE_INTEGER,
      text: '90071992547409.91',
      why: 'the largest amount is exact, with no grouping and no exponent',
    },
  ])('writes $amountMinor minor units as $text ($why)', ({ amountMinor, text }) => {
    expect(majorUnitsText(amountMinor, 2)).toBe(text);
  });
});

describe('employee CSV', () => {
  it('has the agreed header', () => {
    expect(EMPLOYEE_CSV_HEADER_LINE).toBe(
      'Name,Email,Job title,Department,Country,Currency,Annual salary,Employment type,Hire date\r\n',
    );
  });

  it('writes an employee in header order, with the country name and a plain salary', () => {
    expect(employeeCsvLine(priya)).toBe(
      'Priya Sharma,priya.sharma@acme.test,Senior Engineer,Engineering,India,INR,3240000,Full-time,2024-03-01\r\n',
    );
  });

  it.each([
    { employmentType: 'FULL_TIME', label: 'Full-time' },
    { employmentType: 'PART_TIME', label: 'Part-time' },
    { employmentType: 'CONTRACTOR', label: 'Contractor' },
  ])('writes the employment type $employmentType as $label', ({ employmentType, label }) => {
    expect(employeeCsvLine({ ...priya, employmentType })).toContain(`,${label},2024-03-01`);
  });

  it('writes a salary with cents as a plain decimal', () => {
    const line = employeeCsvLine({
      ...priya,
      countryCode: 'US',
      currency: 'USD',
      salaryMinor: 7_500_035,
    });

    expect(line).toContain(',United States,USD,75000.35,');
  });

  it('escapes a name containing a comma and double quotes', () => {
    const line = employeeCsvLine({ ...priya, fullName: 'Sharma, Priya "PJ"' });

    expect(line.startsWith('"Sharma, Priya ""PJ""",priya.sharma@acme.test,')).toBe(true);
  });

  it('neutralises a formula typed into a text field', () => {
    const line = employeeCsvLine({ ...priya, jobTitle: '=cmd|calc' });

    expect(line).toContain(",'=cmd|calc,Engineering,");
  });
});
