import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  TODAY,
  TOMORROW,
  currentPath,
  freezeTodayAt19Nov2026,
  renderApp,
} from '../test/render-app';
import {
  CREATE_URL,
  apiWrites,
  emailInUse,
  invalidInput,
  server,
  serverError,
} from '../test/server';

beforeEach(() => {
  freezeTodayAt19Nov2026();
});

/** Opens the drawer from the directory and returns queries scoped to it. */
async function openAddEmployee() {
  const { user } = renderApp('/employees');
  await screen.findByRole('row', { name: /Priya Sharma/ });
  await user.click(screen.getByRole('button', { name: 'Add employee' }));
  const drawer = within(await screen.findByRole('dialog', { name: 'Add employee' }));
  return { user, drawer };
}

type Drawer = ReturnType<typeof within>;

async function chooseCountry(user: UserEvent, drawer: Drawer, country: string): Promise<void> {
  await user.click(drawer.getByRole('combobox', { name: 'Country' }));
  await user.click(await drawer.findByRole('option', { name: country }));
}

async function typeDate(user: UserEvent, drawer: Drawer, isoDate: string): Promise<void> {
  const input = drawer.getByRole('textbox', { name: 'Hire date' });
  await user.clear(input);
  await user.type(input, isoDate);
  await user.tab();
}

async function fillValidEmployee(user: UserEvent, drawer: Drawer): Promise<void> {
  await user.type(drawer.getByRole('textbox', { name: 'Full name' }), 'Neha Kapoor');
  await user.type(drawer.getByRole('textbox', { name: 'Email' }), 'Neha.Kapoor@acme.test');
  await user.type(drawer.getByRole('combobox', { name: 'Job title' }), 'Engineer');
  await user.type(drawer.getByRole('combobox', { name: 'Department' }), 'Engineering');
  await chooseCountry(user, drawer, 'India');
  await user.type(drawer.getByRole('textbox', { name: 'Annual base salary' }), '1800000');
  await user.click(drawer.getByRole('radio', { name: 'Contractor' }));
  await typeDate(user, drawer, '2026-11-01');
}

function submit(user: UserEvent, drawer: Drawer): Promise<void> {
  return user.click(drawer.getByRole('button', { name: 'Add employee' }));
}

describe('Add employee: the form', () => {
  it('opens empty, with Full-time chosen, and closes on Cancel without saving', async () => {
    const { user, drawer } = await openAddEmployee();

    expect(drawer.getByRole('textbox', { name: 'Full name' })).toHaveValue('');
    expect(drawer.getByRole('textbox', { name: 'Annual base salary' })).toHaveValue('');
    expect(drawer.getByRole('radio', { name: 'Full-time' })).toBeChecked();

    await user.click(drawer.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Add employee' })).not.toBeInTheDocument(),
    );
    expect(apiWrites).toEqual([]);
  });

  it('shows the currency of the chosen country in front of the salary', async () => {
    const { user, drawer } = await openAddEmployee();

    expect(drawer.queryByLabelText('Salary currency')).not.toBeInTheDocument();

    await chooseCountry(user, drawer, 'India');
    expect(drawer.getByLabelText('Salary currency')).toHaveTextContent('INR');

    await chooseCountry(user, drawer, 'Germany');
    expect(drawer.getByLabelText('Salary currency')).toHaveTextContent('EUR');
  });

  it('offers the existing job titles and departments, and accepts a new one', async () => {
    const { user, drawer } = await openAddEmployee();

    await user.click(drawer.getByRole('combobox', { name: 'Job title' }));
    expect(await drawer.findByRole('option', { name: 'Senior Engineer' })).toBeInTheDocument();

    await user.type(drawer.getByRole('combobox', { name: 'Job title' }), 'Chief of Staff');
    expect(drawer.getByRole('combobox', { name: 'Job title' })).toHaveValue('Chief of Staff');

    await user.click(drawer.getByRole('combobox', { name: 'Department' }));
    expect(await drawer.findByRole('option', { name: 'Finance' })).toBeInTheDocument();
  });

  it('groups a typed Indian salary in lakhs', async () => {
    const { user, drawer } = await openAddEmployee();
    await chooseCountry(user, drawer, 'India');

    await user.type(drawer.getByRole('textbox', { name: 'Annual base salary' }), '3240000');

    expect(drawer.getByRole('textbox', { name: 'Annual base salary' })).toHaveValue('32,40,000');
  });
});

describe('Add employee: validation with the shared rules', () => {
  it('shows a message under every required field when the empty form is submitted', async () => {
    const { user, drawer } = await openAddEmployee();

    await submit(user, drawer);

    expect(drawer.getByRole('textbox', { name: 'Full name' })).toHaveAccessibleDescription(
      'Full name is required',
    );
    expect(drawer.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      'Email is required',
    );
    expect(drawer.getByRole('combobox', { name: 'Job title' })).toHaveAccessibleDescription(
      'Job title is required',
    );
    expect(drawer.getByRole('combobox', { name: 'Department' })).toHaveAccessibleDescription(
      'Department is required',
    );
    expect(drawer.getByRole('combobox', { name: 'Country' })).toHaveAccessibleDescription(
      'Country is required',
    );
    expect(drawer.getByRole('textbox', { name: 'Annual base salary' })).toHaveAccessibleDescription(
      'Salary is required',
    );
    expect(drawer.getByRole('textbox', { name: 'Hire date' })).toHaveAccessibleDescription(
      'Hire date is required',
    );
    expect(apiWrites).toEqual([]);
  });

  it('rejects a malformed email', async () => {
    const { user, drawer } = await openAddEmployee();

    await user.type(drawer.getByRole('textbox', { name: 'Email' }), 'not-an-email');
    await submit(user, drawer);

    expect(drawer.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      'Enter a valid email address',
    );
  });

  it('rejects a salary of zero', async () => {
    const { user, drawer } = await openAddEmployee();

    await user.type(drawer.getByRole('textbox', { name: 'Annual base salary' }), '0');
    await submit(user, drawer);

    expect(drawer.getByRole('textbox', { name: 'Annual base salary' })).toHaveAccessibleDescription(
      'Salary must be greater than 0',
    );
  });

  it('rejects a hire date after the user’s own today', async () => {
    const { user, drawer } = await openAddEmployee();

    await typeDate(user, drawer, TOMORROW);
    await submit(user, drawer);

    expect(drawer.getByRole('textbox', { name: 'Hire date' })).toHaveAccessibleDescription(
      'Hire date cannot be in the future',
    );
  });

  it('accepts a hire date of today', async () => {
    const { user, drawer } = await openAddEmployee();

    await typeDate(user, drawer, TODAY);
    await submit(user, drawer);

    expect(drawer.getByRole('textbox', { name: 'Hire date' })).toHaveValue('19 Nov 2026');
    expect(drawer.getByRole('textbox', { name: 'Hire date' })).not.toHaveAccessibleDescription();
  });

  it('clears a field’s message once the field is corrected and the form resubmitted', async () => {
    const { user, drawer } = await openAddEmployee();
    await submit(user, drawer);

    await user.type(drawer.getByRole('textbox', { name: 'Full name' }), 'Neha Kapoor');
    await submit(user, drawer);

    expect(drawer.getByRole('textbox', { name: 'Full name' })).not.toHaveAccessibleDescription();
    expect(drawer.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      'Email is required',
    );
  });
});

describe('Add employee: saving', () => {
  it('sends the employee, then closes, confirms, and opens the new employee’s page', async () => {
    const { user, drawer } = await openAddEmployee();
    await fillValidEmployee(user, drawer);

    await submit(user, drawer);

    expect(await screen.findByRole('heading', { level: 1, name: 'Neha Kapoor' })).toBeVisible();
    expect(currentPath()).toBe('/employees/101');
    expect(screen.queryByRole('dialog', { name: 'Add employee' })).not.toBeInTheDocument();
    expect(screen.getByText('Employee added')).toBeVisible();
    expect(apiWrites).toEqual([
      {
        method: 'POST',
        path: '/api/employees',
        body: {
          fullName: 'Neha Kapoor',
          // Sent as the shared schema normalises it.
          email: 'neha.kapoor@acme.test',
          jobTitle: 'Engineer',
          department: 'Engineering',
          countryCode: 'IN',
          salaryMajor: 1_800_000,
          employmentType: 'CONTRACTOR',
          hireDate: '2026-11-01',
        },
      },
    ]);
  });

  it('shows "email already in use" under Email and keeps the form open', async () => {
    server.use(http.post(CREATE_URL, () => emailInUse('neha.kapoor@acme.test')));
    const { user, drawer } = await openAddEmployee();
    await fillValidEmployee(user, drawer);

    await submit(user, drawer);

    await waitFor(() =>
      expect(drawer.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
        'An employee with the email neha.kapoor@acme.test already exists',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Add employee' })).toBeInTheDocument();
    expect(currentPath()).toBe('/employees');
  });

  it('shows a field problem reported by the server under that field', async () => {
    server.use(
      http.post(CREATE_URL, () =>
        invalidInput([{ path: 'jobTitle', message: 'Job title must be at most 100 characters' }]),
      ),
    );
    const { user, drawer } = await openAddEmployee();
    await fillValidEmployee(user, drawer);

    await submit(user, drawer);

    await waitFor(() =>
      expect(drawer.getByRole('combobox', { name: 'Job title' })).toHaveAccessibleDescription(
        'Job title must be at most 100 characters',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Add employee' })).toBeInTheDocument();
  });

  it('shows any other failure as a notification and keeps the form open', async () => {
    server.use(http.post(CREATE_URL, () => serverError()));
    const { user, drawer } = await openAddEmployee();
    await fillValidEmployee(user, drawer);

    await submit(user, drawer);

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Add employee' })).toBeInTheDocument();
    expect(drawer.getByRole('textbox', { name: 'Full name' })).toHaveValue('Neha Kapoor');
  });
});
