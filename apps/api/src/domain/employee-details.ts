/** The proposed fields that are provided and differ from the current value. */
export function changedFields<T extends object>(current: T, proposed: Partial<T>): Partial<T> {
  const changed: Partial<T> = {};
  for (const field of Object.keys(proposed) as (keyof T)[]) {
    const value = proposed[field];
    if (value !== undefined && value !== current[field]) {
      changed[field] = value;
    }
  }
  return changed;
}

export function isCountryChange(
  currentCountryCode: string,
  proposedCountryCode: string | undefined,
): proposedCountryCode is string {
  return proposedCountryCode !== undefined && proposedCountryCode !== currentCountryCode;
}
