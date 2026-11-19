import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Scoped, TOMORROW, freezeTodayAt19Nov2026, renderApp } from '../test/render-app';
import {
  PRIYA_DETAIL,
  PRIYA_URL,
  SALARY_CHANGES_URL,
  apiWrites,
  detailOf,
  invalidInput,
  server,
  serverError,
} from '../test/server';

beforeEach(() => {
  freezeTodayAt19Nov2026();
});

/** Opens "Change salary" on Priya's page and returns queries scoped to the modal. */
async function openChangeSalary() {
  const { user } = renderApp('/employees/2');
  await screen.findByRole('heading', { level: 1, name: 'Priya Sharma' });
  await user.click(screen.getByRole('button', { name: 'Change salary' }));
  const modal = within(await screen.findByRole('dialog', { name: 'Change salary' }));
  return { user, modal };
}

function salaryInput(modal: Scoped): HTMLElement {
  return modal.getByRole('textbox', { name: 'New annual salary' });
}

function submit(user: UserEvent, modal: Scoped): Promise<void> {
  return user.click(modal.getByRole('button', { name: 'Update salary' }));
}

describe('Change salary: the form', () => {
  it('shows the current salary, the currency, and today as the effective date', async () => {
    const { modal } = await openChangeSalary();

    expect(modal.getByText('Current salary: INR 32,40,000')).toBeVisible();
    expect(modal.getByLabelText('Salary currency')).toHaveTextContent('INR');
    expect(salaryInput(modal)).toHaveValue('');
    expect(modal.getByRole('textbox', { name: 'Effective date' })).toHaveValue('19 Nov 2026');
    expect(modal.getByRole('textbox', { name: 'Reason' })).toHaveValue('');
  });

  it('shows no preview before a new salary is typed', async () => {
    const { modal } = await openChangeSalary();

    expect(modal.queryByText(/per year|No change/)).not.toBeInTheDocument();
  });

  it.each([
    { typed: '3600000', preview: '+11.1% · Increase of INR 3,60,000 per year' },
    { typed: '3000000', preview: '-7.4% · Decrease of INR 2,40,000 per year' },
    { typed: '3240000', preview: 'No change from the current salary' },
  ])('previews "$preview" as $typed is typed', async ({ typed, preview }) => {
    const { user, modal } = await openChangeSalary();

    await user.type(salaryInput(modal), typed);

    expect(modal.getByText(preview)).toBeVisible();
  });

  it('closes on Cancel without saving', async () => {
    const { user, modal } = await openChangeSalary();
    await user.type(salaryInput(modal), '3600000');

    await user.click(modal.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Change salary' })).not.toBeInTheDocument(),
    );
    expect(apiWrites).toEqual([]);
  });
});

describe('Change salary: validation with the shared rules', () => {
  it('requires a new salary and a reason', async () => {
    const { user, modal } = await openChangeSalary();

    await submit(user, modal);

    expect(salaryInput(modal)).toHaveAccessibleDescription('Salary is required');
    expect(modal.getByRole('textbox', { name: 'Reason' })).toHaveAccessibleDescription(
      'Reason is required',
    );
    expect(apiWrites).toEqual([]);
  });

  it('rejects a reason shorter than 3 characters', async () => {
    const { user, modal } = await openChangeSalary();
    await user.type(salaryInput(modal), '3600000');
    await user.type(modal.getByRole('textbox', { name: 'Reason' }), 'ok');

    await submit(user, modal);

    expect(modal.getByRole('textbox', { name: 'Reason' })).toHaveAccessibleDescription(
      'Reason must be at least 3 characters',
    );
    expect(apiWrites).toEqual([]);
  });

  it('rejects a salary change dated in the future', async () => {
    const { user, modal } = await openChangeSalary();
    await user.type(salaryInput(modal), '3600000');
    await user.type(modal.getByRole('textbox', { name: 'Reason' }), 'Promotion to Staff Engineer');
    const effectiveDate = modal.getByRole('textbox', { name: 'Effective date' });
    await user.clear(effectiveDate);
    await user.type(effectiveDate, TOMORROW);
    await user.tab();

    await submit(user, modal);

    expect(effectiveDate).toHaveAccessibleDescription('Effective date cannot be in the future');
    expect(apiWrites).toEqual([]);
  });
});

describe('Change salary: saving', () => {
  it('sends the change, then closes, confirms and shows the new salary and history', async () => {
    const { user, modal } = await openChangeSalary();
    await user.type(salaryInput(modal), '3600000');
    await user.type(modal.getByRole('textbox', { name: 'Reason' }), 'Promotion to Staff Engineer');
    const [latest] = PRIYA_DETAIL.salaryHistory;
    server.use(
      http.get(PRIYA_URL, () =>
        detailOf({
          salaryMinor: 360_000_000,
          salaryHistory: [
            {
              id: 14,
              employeeId: 2,
              oldSalaryMinor: 324_000_000,
              oldCurrency: 'INR',
              newSalaryMinor: 360_000_000,
              currency: 'INR',
              effectiveDate: '2026-11-19',
              reason: 'Promotion to Staff Engineer',
              createdAt: latest?.createdAt ?? '',
            },
            ...PRIYA_DETAIL.salaryHistory,
          ],
        }),
      ),
    );

    await submit(user, modal);

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Change salary' })).not.toBeInTheDocument(),
    );
    expect(apiWrites).toEqual([
      {
        method: 'POST',
        path: '/api/employees/2/salary-changes',
        body: {
          newSalaryMajor: 3_600_000,
          effectiveDate: '2026-11-19',
          reason: 'Promotion to Staff Engineer',
        },
      },
    ]);
    expect(screen.getByText('Salary updated')).toBeVisible();
    const salary = within(screen.getByRole('region', { name: 'Current salary' }));
    expect(await salary.findByText('INR 36,00,000')).toBeVisible();
    expect(salary.getByText('Effective since 19 Nov 2026')).toBeVisible();
    const newest = within(screen.getByRole('list', { name: 'Salary history' })).getAllByRole(
      'listitem',
    )[0];
    expect(newest).toHaveTextContent('INR 32,40,000 → INR 36,00,000');
    expect(newest).toHaveTextContent('+11.1%');
  });

  it('shows a field problem reported by the server under that field and keeps the form open', async () => {
    server.use(
      http.post(SALARY_CHANGES_URL, () =>
        invalidInput([
          { path: 'effectiveDate', message: 'Effective date cannot be before the hire date' },
        ]),
      ),
    );
    const { user, modal } = await openChangeSalary();
    await user.type(salaryInput(modal), '3600000');
    await user.type(modal.getByRole('textbox', { name: 'Reason' }), 'Promotion to Staff Engineer');

    await submit(user, modal);

    await waitFor(() =>
      expect(modal.getByRole('textbox', { name: 'Effective date' })).toHaveAccessibleDescription(
        'Effective date cannot be before the hire date',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Change salary' })).toBeInTheDocument();
  });

  it('shows the server’s "must be different" message under the salary', async () => {
    server.use(
      http.post(SALARY_CHANGES_URL, () =>
        invalidInput([
          {
            path: 'newSalaryMajor',
            message: 'New salary must be different from the current salary',
          },
        ]),
      ),
    );
    const { user, modal } = await openChangeSalary();
    await user.type(salaryInput(modal), '3240000');
    await user.type(modal.getByRole('textbox', { name: 'Reason' }), 'Annual review');

    await submit(user, modal);

    await waitFor(() =>
      expect(salaryInput(modal)).toHaveAccessibleDescription(
        'New salary must be different from the current salary',
      ),
    );
  });

  it('shows any other failure as a notification and keeps the form open', async () => {
    server.use(http.post(SALARY_CHANGES_URL, () => serverError()));
    const { user, modal } = await openChangeSalary();
    await user.type(salaryInput(modal), '3600000');
    await user.type(modal.getByRole('textbox', { name: 'Reason' }), 'Promotion to Staff Engineer');

    await submit(user, modal);

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Change salary' })).toBeInTheDocument();
  });
});
