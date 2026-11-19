import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Scoped, freezeTodayAt19Nov2026, renderApp } from '../test/render-app';
import { EMPLOYEE_URL, PRIYA_URL, apiWrites, detailOf, emailInUse, server } from '../test/server';

beforeEach(() => {
  freezeTodayAt19Nov2026();
});

/** Opens "Edit details" on Priya's page and returns queries scoped to the drawer. */
async function openEditDetails() {
  const { user } = renderApp('/employees/2');
  await screen.findByRole('heading', { level: 1, name: 'Priya Sharma' });
  await user.click(screen.getByRole('button', { name: 'Edit details' }));
  const drawer = within(await screen.findByRole('dialog', { name: 'Edit details' }));
  return { user, drawer };
}

async function replaceText(user: UserEvent, input: HTMLElement, text: string): Promise<void> {
  await user.clear(input);
  if (text !== '') {
    await user.type(input, text);
  }
}

async function chooseCountry(user: UserEvent, drawer: Scoped, country: string): Promise<void> {
  await user.click(drawer.getByRole('combobox', { name: 'Country' }));
  await user.click(await drawer.findByRole('option', { name: country }));
}

function saveButton(drawer: Scoped): HTMLElement {
  return drawer.getByRole('button', { name: 'Save changes' });
}

describe('Edit details: the form', () => {
  it('opens filled with the employee’s current details', async () => {
    const { drawer } = await openEditDetails();

    expect(drawer.getByRole('textbox', { name: 'Full name' })).toHaveValue('Priya Sharma');
    expect(drawer.getByRole('textbox', { name: 'Email' })).toHaveValue('priya.sharma@acme.test');
    expect(drawer.getByRole('combobox', { name: 'Job title' })).toHaveValue('Senior Engineer');
    expect(drawer.getByRole('combobox', { name: 'Department' })).toHaveValue('Engineering');
    expect(drawer.getByRole('combobox', { name: 'Country' })).toHaveValue('India');
    expect(drawer.getByRole('radio', { name: 'Full-time' })).toBeChecked();
    expect(drawer.getByRole('textbox', { name: 'Hire date' })).toHaveValue('12 Mar 2021');
  });

  it('has no salary field, and says where salary is changed instead', async () => {
    const { drawer } = await openEditDetails();

    expect(drawer.queryByRole('textbox', { name: /salary/i })).not.toBeInTheDocument();
    expect(drawer.getByText('To change the salary, use Change salary.')).toBeVisible();
  });

  it('keeps Save disabled until something is changed, and disables it again if the change is undone', async () => {
    const { user, drawer } = await openEditDetails();
    const jobTitle = drawer.getByRole('combobox', { name: 'Job title' });

    expect(saveButton(drawer)).toBeDisabled();

    await replaceText(user, jobTitle, 'Staff Engineer');
    expect(saveButton(drawer)).toBeEnabled();

    await replaceText(user, jobTitle, 'Senior Engineer');
    expect(saveButton(drawer)).toBeDisabled();
  });
});

describe('Edit details: saving', () => {
  it('sends only the field that changed, then closes, confirms and shows the new value', async () => {
    const { user, drawer } = await openEditDetails();
    await replaceText(user, drawer.getByRole('combobox', { name: 'Job title' }), 'Staff Engineer');
    server.use(http.get(PRIYA_URL, () => detailOf({ jobTitle: 'Staff Engineer' })));

    await user.click(saveButton(drawer));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Edit details' })).not.toBeInTheDocument(),
    );
    expect(apiWrites).toEqual([
      { method: 'PATCH', path: '/api/employees/2', body: { jobTitle: 'Staff Engineer' } },
    ]);
    expect(screen.getByText('Details updated')).toBeVisible();
    const summary = within(screen.getByRole('region', { name: 'Employee summary' }));
    expect(await summary.findByText('Staff Engineer')).toBeVisible();
  });

  it('sends several changed fields together, and nothing that stayed the same', async () => {
    const { user, drawer } = await openEditDetails();
    await replaceText(user, drawer.getByRole('textbox', { name: 'Full name' }), 'Priya Rao');
    await user.click(drawer.getByRole('radio', { name: 'Part-time' }));
    const hireDate = drawer.getByRole('textbox', { name: 'Hire date' });
    await replaceText(user, hireDate, '2021-03-01');
    await user.tab();

    await user.click(saveButton(drawer));

    await waitFor(() => expect(apiWrites).toHaveLength(1));
    expect(apiWrites[0]).toEqual({
      method: 'PATCH',
      path: '/api/employees/2',
      body: { fullName: 'Priya Rao', employmentType: 'PART_TIME', hireDate: '2021-03-01' },
    });
  });

  it('validates a changed field with the shared rules before sending anything', async () => {
    const { user, drawer } = await openEditDetails();
    await replaceText(user, drawer.getByRole('textbox', { name: 'Email' }), 'not-an-email');
    await replaceText(user, drawer.getByRole('textbox', { name: 'Full name' }), '');

    await user.click(saveButton(drawer));

    expect(drawer.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
      'Enter a valid email address',
    );
    expect(drawer.getByRole('textbox', { name: 'Full name' })).toHaveAccessibleDescription(
      'Full name is required',
    );
    expect(apiWrites).toEqual([]);
  });

  it('shows "email already in use" under Email and keeps the form open', async () => {
    server.use(http.patch(EMPLOYEE_URL, () => emailInUse('hans.becker@acme.test')));
    const { user, drawer } = await openEditDetails();
    await replaceText(
      user,
      drawer.getByRole('textbox', { name: 'Email' }),
      'hans.becker@acme.test',
    );

    await user.click(saveButton(drawer));

    await waitFor(() =>
      expect(drawer.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription(
        'An employee with the email hans.becker@acme.test already exists',
      ),
    );
    expect(screen.getByRole('dialog', { name: 'Edit details' })).toBeInTheDocument();
  });
});

describe('Edit details: changing the country', () => {
  it('asks for a new salary in the new currency and a reason only while the country differs', async () => {
    const { user, drawer } = await openEditDetails();

    expect(drawer.queryByRole('textbox', { name: 'New annual salary' })).not.toBeInTheDocument();
    expect(drawer.queryByRole('textbox', { name: 'Reason' })).not.toBeInTheDocument();

    await chooseCountry(user, drawer, 'Germany');

    expect(drawer.getByRole('textbox', { name: 'New annual salary' })).toBeVisible();
    expect(drawer.getByRole('textbox', { name: 'Reason' })).toBeVisible();
    expect(drawer.getByLabelText('Salary currency')).toHaveTextContent('EUR');

    await chooseCountry(user, drawer, 'India');

    expect(drawer.queryByRole('textbox', { name: 'New annual salary' })).not.toBeInTheDocument();
    expect(drawer.queryByRole('textbox', { name: 'Reason' })).not.toBeInTheDocument();
  });

  it('requires the new salary and the reason before a country change can be saved', async () => {
    const { user, drawer } = await openEditDetails();
    await chooseCountry(user, drawer, 'Germany');

    await user.click(saveButton(drawer));

    expect(drawer.getByRole('textbox', { name: 'New annual salary' })).toHaveAccessibleDescription(
      'A new salary is required when the country changes',
    );
    expect(drawer.getByRole('textbox', { name: 'Reason' })).toHaveAccessibleDescription(
      'A reason is required when the country changes',
    );
    expect(apiWrites).toEqual([]);
  });

  it('sends the country with its new salary and reason', async () => {
    const { user, drawer } = await openEditDetails();
    await chooseCountry(user, drawer, 'Germany');
    await user.type(drawer.getByRole('textbox', { name: 'New annual salary' }), '85000');
    await user.type(drawer.getByRole('textbox', { name: 'Reason' }), 'Relocated to Berlin');

    await user.click(saveButton(drawer));

    await waitFor(() => expect(apiWrites).toHaveLength(1));
    expect(apiWrites[0]).toEqual({
      method: 'PATCH',
      path: '/api/employees/2',
      body: { countryCode: 'DE', newSalaryMajor: 85_000, reason: 'Relocated to Berlin' },
    });
  });

  it('does not send a salary or reason typed before the country was changed back', async () => {
    const { user, drawer } = await openEditDetails();
    await chooseCountry(user, drawer, 'Germany');
    await user.type(drawer.getByRole('textbox', { name: 'New annual salary' }), '85000');
    await user.type(drawer.getByRole('textbox', { name: 'Reason' }), 'Relocated to Berlin');
    await chooseCountry(user, drawer, 'India');
    await replaceText(user, drawer.getByRole('combobox', { name: 'Department' }), 'Platform');

    await user.click(saveButton(drawer));

    await waitFor(() => expect(apiWrites).toHaveLength(1));
    expect(apiWrites[0]?.body).toEqual({ department: 'Platform' });
  });
});
