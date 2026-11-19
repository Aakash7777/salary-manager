import type { UseFormReturnType } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { type EmployeeFormValues, fieldErrorsFrom, serverErrorOutcome } from './form-input';

export function notifySaved(title: string, message: string): void {
  notifications.show({ color: 'green', title, message });
}

export function notifyFailed(message: string): void {
  notifications.show({ color: 'red', title: 'That did not work', message });
}

interface SchemaIssue {
  path: PropertyKey[];
  message: string;
}

/** Shows a shared schema's issues under their inputs. */
export function showSchemaIssues<Values>(
  form: UseFormReturnType<Values>,
  issues: SchemaIssue[],
): void {
  form.setErrors(
    fieldErrorsFrom(
      issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    ),
  );
}

/** Shows a failed save under the matching inputs where it can, otherwise as a notification. */
export function showServerError<Values>(form: UseFormReturnType<Values>, error: unknown): void {
  const { fieldErrors, notice } = serverErrorOutcome(error);
  form.setErrors(fieldErrors);
  if (notice !== null) {
    notifyFailed(notice);
  }
}

export type EmployeeForm = UseFormReturnType<EmployeeFormValues>;
