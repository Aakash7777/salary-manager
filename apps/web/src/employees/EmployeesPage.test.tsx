import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { currentParams, currentPath, renderApp } from '../test/render-app';
import {
  EMPLOYEES_URL,
  FIRST_PAGE,
  SECOND_PAGE,
  TOTAL_EMPLOYEES,
  emptyPage,
  employeeRequests,
  lastEmployeeRequest,
  server,
  serverError,
} from '../test/server';

async function renderDirectory(url = '/employees') {
  const rendered = renderApp(url);
  await screen.findByRole('row', { name: /Priya Sharma/ });
  return rendered;
}

function exportLinkParams(): Record<string, string> {
  const href = screen.getByRole('link', { name: 'Export CSV' }).getAttribute('href') ?? '';
  expect(href.split('?')[0]).toBe('/api/employees/export.csv');
  return Object.fromEntries(new URLSearchParams(href.split('?')[1] ?? ''));
}

describe('Employees directory: showing employees', () => {
  it('renders a row per employee from the API, formatted for reading', async () => {
    await renderDirectory();

    const priya = within(screen.getByRole('row', { name: /Priya Sharma/ }));
    expect(priya.getByText('PS')).toBeInTheDocument();
    expect(priya.getByText('priya.sharma@acme.test')).toBeInTheDocument();
    expect(priya.getByText('Senior Engineer')).toBeInTheDocument();
    expect(priya.getByText('Engineering')).toBeInTheDocument();
    expect(priya.getByText('India')).toBeInTheDocument();
    expect(priya.getByText('INR 32,40,000')).toBeInTheDocument();
    expect(priya.getByText('Full-time')).toBeInTheDocument();
    expect(priya.getByText('1 Mar 2024')).toBeInTheDocument();

    const hans = within(screen.getByRole('row', { name: /Hans Becker/ }));
    expect(hans.getByText('Germany')).toBeInTheDocument();
    expect(hans.getByText('EUR 98,000.50')).toBeInTheDocument();
    expect(hans.getByText('Part-time')).toBeInTheDocument();
    expect(hans.getByText('3 Oct 2016')).toBeInTheDocument();
  });

  it('shows the title with the total beside it, and the page actions', async () => {
    await renderDirectory();

    expect(screen.getByRole('heading', { level: 1, name: 'Employees' })).toBeVisible();
    expect(screen.getByLabelText('Total employees')).toHaveTextContent('1,240');
    expect(screen.getByRole('link', { name: 'Export CSV' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Add employee' })).toBeVisible();
  });

  it('asks the API for 25 employees per page', async () => {
    await renderDirectory();

    expect(lastEmployeeRequest()).toEqual({ pageSize: '25' });
  });

  it('goes to the employee’s page when their row is clicked', async () => {
    const { user } = await renderDirectory();

    await user.click(screen.getByRole('row', { name: /Priya Sharma/ }));

    expect(currentPath()).toBe('/employees/2');
  });
});

describe('Employees directory: search and filters', () => {
  it('sends the search text once, after typing stops, and puts it in the URL', async () => {
    const { user } = await renderDirectory();

    await user.type(screen.getByRole('textbox', { name: 'Search by name or email' }), 'priya');

    await waitFor(() => expect(lastEmployeeRequest()).toMatchObject({ search: 'priya' }));
    // One request for the finished word, none for "p", "pr", "pri" or "priy".
    expect(employeeRequests.map((request) => request.search).filter(Boolean)).toEqual(['priya']);
    expect(currentParams()).toEqual({ search: 'priya' });
  });

  it('sends the chosen country and goes back to page 1', async () => {
    const { user } = await renderDirectory('/employees?page=3');

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'India' }));

    await waitFor(() => expect(lastEmployeeRequest()).toMatchObject({ country: 'IN' }));
    expect(lastEmployeeRequest()).not.toHaveProperty('page');
    expect(currentParams()).toEqual({ country: 'IN' });
  });

  it('offers the departments and job titles from the API, and sends the ones chosen', async () => {
    const { user } = await renderDirectory();

    await user.click(screen.getByRole('combobox', { name: 'Department' }));
    await user.click(await screen.findByRole('option', { name: 'Finance' }));
    await user.click(screen.getByRole('combobox', { name: 'Job title' }));
    await user.click(await screen.findByRole('option', { name: 'Analyst' }));

    await waitFor(() =>
      expect(lastEmployeeRequest()).toMatchObject({ department: 'Finance', jobTitle: 'Analyst' }),
    );
    expect(currentParams()).toEqual({ department: 'Finance', jobTitle: 'Analyst' });
  });

  it('reads search, filters, sort and page from the URL when the page loads', async () => {
    await renderDirectory(
      '/employees?search=sharma&country=IN&department=Engineering&jobTitle=Senior%20Engineer&sort=hireDate&order=desc&page=3',
    );

    expect(employeeRequests[0]).toEqual({
      search: 'sharma',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Senior Engineer',
      sort: 'hireDate',
      order: 'desc',
      page: '3',
      pageSize: '25',
    });
    expect(screen.getByRole('textbox', { name: 'Search by name or email' })).toHaveValue('sharma');
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('India');
    expect(screen.getByRole('combobox', { name: 'Department' })).toHaveValue('Engineering');
    expect(screen.getByRole('combobox', { name: 'Job title' })).toHaveValue('Senior Engineer');
  });

  it('shows a removable chip for each active filter, and the number of results', async () => {
    const { user } = await renderDirectory(
      '/employees?search=sharma&country=IN&department=Engineering',
    );

    expect(screen.getByText('Search: sharma')).toBeVisible();
    expect(screen.getByText('Country: India')).toBeVisible();
    expect(screen.getByText('Department: Engineering')).toBeVisible();
    expect(screen.getByText('1,240 results')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remove Country filter' }));

    await waitFor(() => expect(lastEmployeeRequest()).not.toHaveProperty('country'));
    expect(currentParams()).toEqual({ search: 'sharma', department: 'Engineering' });
    expect(screen.queryByText('Country: India')).not.toBeInTheDocument();
  });

  it('shows no chips when no filter is active', async () => {
    await renderDirectory();

    expect(screen.queryByRole('button', { name: /^Remove .* filter$/ })).not.toBeInTheDocument();
  });

  it('clears search and filters with "Clear filters", keeping the sort and returning to page 1', async () => {
    const { user } = await renderDirectory(
      '/employees?search=sharma&country=IN&sort=salary&order=desc&page=3',
    );

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() =>
      expect(lastEmployeeRequest()).toEqual({ sort: 'salary', order: 'desc', pageSize: '25' }),
    );
    expect(currentParams()).toEqual({ sort: 'salary', order: 'desc' });
    expect(screen.getByRole('textbox', { name: 'Search by name or email' })).toHaveValue('');
  });
});

describe('Employees directory: sorting', () => {
  it('starts sorted by name A to Z, without putting the defaults in the URL', async () => {
    await renderDirectory();

    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    expect(screen.getByRole('columnheader', { name: /Annual salary/ })).not.toHaveAttribute(
      'aria-sort',
    );
    expect(currentParams()).toEqual({});
  });

  it('sorts by salary lowest first on the first click, and highest first on the second', async () => {
    const { user } = await renderDirectory();
    const salaryHeader = () => screen.getByRole('columnheader', { name: /Annual salary/ });

    await user.click(within(salaryHeader()).getByRole('button'));

    await waitFor(() => expect(lastEmployeeRequest()).toMatchObject({ sort: 'salary' }));
    expect(lastEmployeeRequest()).not.toHaveProperty('order');
    expect(salaryHeader()).toHaveAttribute('aria-sort', 'ascending');
    expect(currentParams()).toEqual({ sort: 'salary' });

    await user.click(within(salaryHeader()).getByRole('button'));

    await waitFor(() =>
      expect(lastEmployeeRequest()).toMatchObject({ sort: 'salary', order: 'desc' }),
    );
    expect(salaryHeader()).toHaveAttribute('aria-sort', 'descending');
    expect(currentParams()).toEqual({ sort: 'salary', order: 'desc' });
  });

  it('reverses the name sort when the Name header is clicked', async () => {
    const { user } = await renderDirectory();

    await user.click(
      within(screen.getByRole('columnheader', { name: /Name/ })).getByRole('button'),
    );

    await waitFor(() => expect(lastEmployeeRequest()).toMatchObject({ order: 'desc' }));
    expect(currentParams()).toEqual({ order: 'desc' });
  });

  it('goes back to page 1 when the sort changes', async () => {
    const { user } = await renderDirectory('/employees?page=3');

    await user.click(
      within(screen.getByRole('columnheader', { name: /Hire date/ })).getByRole('button'),
    );

    await waitFor(() => expect(lastEmployeeRequest()).toMatchObject({ sort: 'hireDate' }));
    expect(currentParams()).toEqual({ sort: 'hireDate' });
  });

  it('only offers sorting on Name, Annual salary and Hire date', async () => {
    await renderDirectory();

    const sortable = screen
      .getAllByRole('columnheader')
      .filter((header) => within(header).queryByRole('button') !== null)
      .map((header) => header.textContent);

    expect(sortable).toEqual(['Name', 'Annual salary', 'Hire date']);
  });

  it('explains that salaries are not converted when sorting by salary across countries', async () => {
    await renderDirectory('/employees?sort=salary');

    expect(screen.getByText('Sorted by amount. Currencies are not converted.')).toBeVisible();
  });

  it.each([
    { url: '/employees?sort=salary&country=IN', why: 'one country means one currency' },
    { url: '/employees?sort=hireDate', why: 'the sort is not by salary' },
    { url: '/employees', why: 'the sort is not by salary' },
  ])('does not show the currency note at $url, because $why', async ({ url }) => {
    await renderDirectory(url);

    expect(
      screen.queryByText('Sorted by amount. Currencies are not converted.'),
    ).not.toBeInTheDocument();
  });
});

describe('Employees directory: pagination', () => {
  it('says which employees are shown out of the total', async () => {
    await renderDirectory();

    expect(screen.getByText('Showing 1–25 of 1,240')).toBeVisible();
  });

  it('requests the next page, keeping the current rows visible until it arrives', async () => {
    const { user } = await renderDirectory();
    server.use(
      http.get(
        EMPLOYEES_URL,
        async ({ request }) => {
          employeeRequests.push(Object.fromEntries(new URL(request.url).searchParams));
          await delay(100);
          return HttpResponse.json({
            items: SECOND_PAGE,
            total: TOTAL_EMPLOYEES,
            page: 2,
            pageSize: 25,
          });
        },
        { once: true },
      ),
    );

    await user.click(screen.getByRole('button', { name: 'Next page' }));

    // The previous page stays on screen while page 2 is on its way.
    expect(screen.getByRole('row', { name: /Priya Sharma/ })).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /Zara Ahmed/ })).toBeInTheDocument();
    expect(screen.queryByRole('row', { name: /Priya Sharma/ })).not.toBeInTheDocument();
    expect(lastEmployeeRequest()).toEqual({ page: '2', pageSize: '25' });
    expect(currentParams()).toEqual({ page: '2' });
    expect(screen.getByText('Showing 26–50 of 1,240')).toBeVisible();
  });

  it('shows the real end of the range on the last page', async () => {
    await renderDirectory('/employees?page=50');

    // 1,240 employees in pages of 25: page 50 holds 1,226 to 1,240.
    expect(screen.getByText('Showing 1,226–1,240 of 1,240')).toBeVisible();
  });
});

describe('Employees directory: export', () => {
  it('links to the CSV export with no parameters when nothing is filtered', async () => {
    await renderDirectory();

    expect(exportLinkParams()).toEqual({});
  });

  it('carries the current search, filters and sort in the export link, but not the page', async () => {
    await renderDirectory(
      '/employees?search=sharma&country=IN&department=Engineering&jobTitle=Engineer&sort=salary&order=desc&page=3',
    );

    expect(exportLinkParams()).toEqual({
      search: 'sharma',
      country: 'IN',
      department: 'Engineering',
      jobTitle: 'Engineer',
      sort: 'salary',
      order: 'desc',
    });
  });
});

describe('Employees directory: loading, empty and error states', () => {
  it('shows a loading state until the first page arrives', async () => {
    server.use(
      http.get(EMPLOYEES_URL, async () => {
        await delay(50);
        return HttpResponse.json({
          items: FIRST_PAGE,
          total: TOTAL_EMPLOYEES,
          page: 1,
          pageSize: 25,
        });
      }),
    );

    renderApp('/employees');

    expect(screen.getByText('Loading employees')).toBeInTheDocument();
    expect(await screen.findByRole('row', { name: /Priya Sharma/ })).toBeInTheDocument();
    expect(screen.queryByText('Loading employees')).not.toBeInTheDocument();
  });

  it('shows an empty state with a way to clear the filters when nothing matches', async () => {
    server.use(http.get(EMPLOYEES_URL, () => emptyPage(), { once: true }));

    const { user } = renderApp('/employees?search=nobody&country=IN');

    expect(await screen.findByText('No employees match your filters')).toBeVisible();
    expect(screen.queryByRole('row', { name: /Priya Sharma/ })).not.toBeInTheDocument();

    const emptyState = screen.getByText('No employees match your filters').closest('section');
    expect(emptyState).not.toBeNull();
    await user.click(
      within(emptyState as HTMLElement).getByRole('button', { name: 'Clear filters' }),
    );

    expect(await screen.findByRole('row', { name: /Priya Sharma/ })).toBeInTheDocument();
    expect(currentParams()).toEqual({});
  });

  it('shows an error state when the API fails, and loads the employees after Retry', async () => {
    server.use(http.get(EMPLOYEES_URL, () => serverError(), { once: true }));

    const { user } = renderApp('/employees');

    expect(await screen.findByText('Could not load employees')).toBeVisible();
    expect(screen.queryByRole('row', { name: /Priya Sharma/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('row', { name: /Priya Sharma/ })).toBeInTheDocument();
    expect(screen.queryByText('Could not load employees')).not.toBeInTheDocument();
  });
});
