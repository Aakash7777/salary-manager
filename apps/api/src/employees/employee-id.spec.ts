import { describe, expect, it } from 'vitest';
import { parseEmployeeId } from './employee-id.js';
import { InvalidInputError } from './errors.js';

describe('parseEmployeeId', () => {
  it.each([
    { raw: '1', id: 1 },
    { raw: '42', id: 42 },
    { raw: '0', id: 0 },
    { raw: '9007199254740991', id: Number.MAX_SAFE_INTEGER },
  ])('reads "$raw" as $id', ({ raw, id }) => {
    expect(parseEmployeeId(raw)).toBe(id);
  });

  it.each(['abc', '1.5', '-1', '', ' 1', '1e3', '0x10', '9007199254740992'])(
    'rejects "%s" because it is not a whole number that can be an id',
    (raw) => {
      let thrown: unknown;
      try {
        parseEmployeeId(raw);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(InvalidInputError);
      expect(thrown).toMatchObject({
        issues: [{ path: 'id', message: 'Employee id must be a whole number' }],
      });
    },
  );
});
