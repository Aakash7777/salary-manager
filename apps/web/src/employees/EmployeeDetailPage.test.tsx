import { screen, within } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { currentPath, renderApp } from '../test/render-app';
import { PRIYA_DETAIL, PRIYA_URL, detailOf, server, serverError } from '../test/server';

async function renderPriya() {
  const rendered = renderApp('/employees/2');
  await screen.findByRole('heading', { level: 1, name: 'Priya Sharma' });
  return rendered;
}

describe('Employee detail: what it shows', () => {
  it('has a breadcrumb back to the directory', async () => {
    await renderPriya();

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });

    expect(within(breadcrumb).getByRole('link', { name: 'Employees' })).toHaveAttribute(
      'href',
      '/employees',
    );
    expect(within(breadcrumb).getByText('Priya Sharma')).toBeVisible();
  });

  it('summarises who the employee is, with the actions for them', async () => {
    await renderPriya();

    const summary = within(screen.getByRole('region', { name: 'Employee summary' }));

    expect(summary.getByText('PS')).toBeInTheDocument();
    expect(summary.getByText('Full-time')).toBeVisible();
    expect(summary.getByText('Senior Engineer')).toBeVisible();
    expect(summary.getByText('Engineering')).toBeVisible();
    expect(summary.getByText('India')).toBeVisible();
    expect(summary.getByText('Hired 12 Mar 2021')).toBeVisible();
    expect(summary.getByRole('button', { name: 'Edit details' })).toBeVisible();
    expect(summary.getByRole('button', { name: 'Remove employee' })).toBeVisible();
  });

  it('shows the current salary and when it took effect', async () => {
    await renderPriya();

    const salary = within(screen.getByRole('region', { name: 'Current salary' }));

    expect(salary.getByText('INR 32,40,000')).toBeVisible();
    // The date of the newest history entry.
    expect(salary.getByText('Effective since 1 Apr 2025')).toBeVisible();
    expect(salary.getByRole('button', { name: 'Change salary' })).toBeVisible();
  });

  it.each([
    {
      when: 'above the role median',
      detail: { roleMedianMinor: 305_000_000, pctVsRoleMedian: 6.2 },
      line: 'Median for this role in India: INR 30,50,000 · 6.2% above',
    },
    {
      when: 'below the role median',
      detail: { roleMedianMinor: 340_000_000, pctVsRoleMedian: -4.7 },
      line: 'Median for this role in India: INR 34,00,000 · 4.7% below',
    },
    {
      when: 'exactly at the role median',
      detail: { roleMedianMinor: 324_000_000, pctVsRoleMedian: 0 },
      line: 'Median for this role in India: INR 32,40,000 · at the median',
    },
    {
      when: 'the only person in the role',
      detail: { roleMedianMinor: null, pctVsRoleMedian: null },
      line: 'Only person in this role in India',
    },
  ])('compares the salary with the role when the employee is $when', async ({ detail, line }) => {
    server.use(http.get(PRIYA_URL, () => detailOf(detail)));

    await renderPriya();

    const salary = within(screen.getByRole('region', { name: 'Current salary' }));
    expect(salary.getByText(line)).toBeVisible();
  });

  it('lists the details, with the currency marked as set by the country', async () => {
    await renderPriya();

    const details = within(screen.getByRole('region', { name: 'Details' }));

    expect(details.getByText('priya.sharma@acme.test')).toBeVisible();
    expect(details.getByText('Senior Engineer')).toBeVisible();
    expect(details.getByText('Engineering')).toBeVisible();
    expect(details.getByText('India')).toBeVisible();
    expect(details.getByText('INR (set by country)')).toBeVisible();
    expect(details.getByText('Full-time')).toBeVisible();
    expect(details.getByText('12 Mar 2021')).toBeVisible();
  });

  it('shows the salary history newest first, one entry of each kind', async () => {
    await renderPriya();

    const entries = within(screen.getByRole('list', { name: 'Salary history' })).getAllByRole(
      'listitem',
    );
    const [raise, cut, countryChange, starting] = entries;

    expect(entries).toHaveLength(4);

    expect(raise).toHaveTextContent('INR 30,00,000 → INR 32,40,000');
    expect(raise).toHaveTextContent('+8.0%');
    expect(raise).toHaveTextContent('1 Apr 2025');
    expect(raise).toHaveTextContent('Promotion to Senior Engineer');

    expect(cut).toHaveTextContent('INR 31,00,000 → INR 30,00,000');
    expect(cut).toHaveTextContent('-3.2%');
    expect(cut).toHaveTextContent('1 Jul 2023');
    expect(cut).toHaveTextContent('Reduced working hours');

    // A move between currencies shows both, and no percentage that would compare them.
    expect(countryChange).toHaveTextContent('GBP 28,000 → INR 31,00,000');
    expect(countryChange).toHaveTextContent('Country change');
    expect(countryChange).toHaveTextContent('10 Jan 2022');
    expect(countryChange).toHaveTextContent('Relocated to Bengaluru');
    expect(countryChange).not.toHaveTextContent('%');

    expect(starting).toHaveTextContent('Starting salary');
    expect(starting).toHaveTextContent('GBP 28,000');
    expect(starting).toHaveTextContent('12 Mar 2021');
    expect(starting).not.toHaveTextContent('→');
    expect(starting).not.toHaveTextContent('%');
  });
});

describe('Employee detail: loading and failure', () => {
  it('shows a loading state until the employee arrives', async () => {
    server.use(
      http.get(PRIYA_URL, async () => {
        await delay(50);
        return detailOf({});
      }),
    );

    renderApp('/employees/2');

    expect(screen.getByText('Loading employee')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Sharma' })).toBeVisible();
    expect(screen.queryByText('Loading employee')).not.toBeInTheDocument();
  });

  it('says the employee was not found for an unknown id, with a link back to the directory', async () => {
    const { user } = renderApp('/employees/999');

    expect(await screen.findByText('Employee not found')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to Employees' }));

    expect(currentPath()).toBe('/employees');
  });

  it('shows an error with Retry for any other failure, and loads the employee after it', async () => {
    server.use(http.get(PRIYA_URL, () => serverError(), { once: true }));

    const { user } = renderApp('/employees/2');

    expect(await screen.findByText('Could not load this employee')).toBeVisible();
    expect(screen.queryByText('Employee not found')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Priya Sharma' })).toBeVisible();
    expect(screen.getByText(`Hired 12 Mar ${PRIYA_DETAIL.hireDate.slice(0, 4)}`)).toBeVisible();
  });
});
