const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2024-03-01" becomes "1 Mar 2024". Read as text, so no timezone can shift the day. */
export function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  const monthName = MONTHS[Number(month) - 1];
  return monthName ? `${Number(day)} ${monthName} ${year}` : isoDate;
}

/** Up to two initials: the first letters of the first and last words of a name. */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words.at(-1)?.[0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

const EMPLOYMENT_TYPES: Record<string, { label: string; color: string }> = {
  FULL_TIME: { label: 'Full-time', color: 'indigo' },
  PART_TIME: { label: 'Part-time', color: 'teal' },
  CONTRACTOR: { label: 'Contractor', color: 'orange' },
};

export function employmentTypeBadge(employmentType: string): { label: string; color: string } {
  return EMPLOYMENT_TYPES[employmentType] ?? { label: employmentType, color: 'gray' };
}

const WHOLE_NUMBER = new Intl.NumberFormat('en-US');

/** A count with thousands separators: 1240 becomes "1,240". */
export function formatCount(count: number): string {
  return WHOLE_NUMBER.format(count);
}
