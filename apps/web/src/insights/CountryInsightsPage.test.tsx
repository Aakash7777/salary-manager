import { screen, within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { currentPath, renderApp } from '../test/render-app';
import {
  COUNTRY_JOB_TITLES_URL,
  INDIA_JOB_TITLES,
  INSIGHTS_COUNTRIES_URL,
  jobTitleRequests,
  server,
  serverError,
} from '../test/server';

async function renderCountry(code: string, countryName: string) {
  const rendered = renderApp(`/insights/${code}`);
  await screen.findByRole('table', { name: `Pay by job title in ${countryName}` });
  return rendered;
}

function firstCells(table: HTMLElement): (string | null | undefined)[] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
}

describe('Country insights: the country', () => {
  it('has a breadcrumb back to Insights', async () => {
    await renderCountry('IN', 'India');

    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });

    expect(within(breadcrumb).getByRole('link', { name: 'Insights' })).toHaveAttribute(
      'href',
      '/insights',
    );
    expect(within(breadcrumb).getByText('India')).toBeVisible();
  });

  it('heads the page with the country, its headcount and currency, and its median and average', async () => {
    await renderCountry('IN', 'India');

    expect(screen.getByRole('heading', { level: 1, name: 'India' })).toBeVisible();
    expect(screen.getByText('4,200 employees · all amounts in INR')).toBeVisible();
    const summary = screen.getByRole('region', { name: 'Country summary' });
    expect(within(summary).getByLabelText('Median')).toHaveTextContent('INR 17,50,000');
    expect(within(summary).getByLabelText('Average')).toHaveTextContent('INR 18,69,300');
  });
});

describe('Country insights: pay by job title', () => {
  it('lists the job titles with the highest median first, as the API orders them', async () => {
    await renderCountry('IN', 'India');
    const table = screen.getByRole('table', { name: 'Pay by job title in India' });

    expect(firstCells(table)).toEqual(['Staff Engineer', 'Senior Engineer', 'Engineer']);
  });

  it('shows headcount and pay statistics for each job title', async () => {
    await renderCountry('IN', 'India');
    const table = within(screen.getByRole('table', { name: 'Pay by job title in India' }));

    const senior = within(table.getByRole('row', { name: /^Senior Engineer/ }));
    expect(senior.getByText('1,200')).toBeVisible();
    expect(senior.getByText('INR 22,00,000')).toBeVisible();
    expect(senior.getByText('INR 26,10,000')).toBeVisible();
    expect(senior.getByText('INR 26,50,000')).toBeVisible();
    expect(senior.getByText('INR 41,00,000')).toBeVisible();

    expect(table.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Job title',
      'Headcount',
      'Min',
      'Median',
      'Average',
      'Max',
    ]);
  });
});

describe('Country insights: outliers', () => {
  it('says how many there are and what makes someone an outlier', async () => {
    await renderCountry('IN', 'India');

    const outliers = within(screen.getByRole('region', { name: 'Outliers' }));

    expect(outliers.getByLabelText('Number of outliers')).toHaveTextContent('2');
    expect(
      outliers.getByText(
        'Paid more than 25% above or below the median for their job title in India.',
      ),
    ).toBeVisible();
  });

  it('shows an outlier above the median with their salary, the role median and an "above" badge', async () => {
    await renderCountry('IN', 'India');
    const table = within(screen.getByRole('table', { name: 'Outliers in India' }));

    const neha = within(table.getByRole('row', { name: /Neha Kapoor/ }));

    expect(neha.getByText('NK')).toBeInTheDocument();
    expect(neha.getByText('Engineer')).toBeVisible();
    expect(neha.getByText('INR 20,00,000')).toBeVisible();
    expect(neha.getByText('INR 12,60,000')).toBeVisible();
    expect(neha.getByText('58.7% above')).toBeVisible();
  });

  it('shows an outlier below the median with a "below" badge', async () => {
    await renderCountry('IN', 'India');
    const table = within(screen.getByRole('table', { name: 'Outliers in India' }));

    const aarav = within(table.getByRole('row', { name: /Aarav Mehta/ }));

    expect(aarav.getByText('Senior Engineer')).toBeVisible();
    expect(aarav.getByText('INR 18,00,000')).toBeVisible();
    expect(aarav.getByText('INR 26,10,000')).toBeVisible();
    expect(aarav.getByText('31.0% below')).toBeVisible();
  });

  it('lists the outliers with the largest gap first, as the API orders them', async () => {
    await renderCountry('IN', 'India');

    const names = within(screen.getByRole('table', { name: 'Outliers in India' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getByRole('link', { name: 'View profile' }).getAttribute('href'));

    expect(names).toEqual(['/employees/41', '/employees/87']);
  });

  it('opens the employee’s profile from "View profile"', async () => {
    const { user } = await renderCountry('IN', 'India');
    const table = within(screen.getByRole('table', { name: 'Outliers in India' }));

    await user.click(
      within(table.getByRole('row', { name: /Aarav Mehta/ })).getByRole('link', {
        name: 'View profile',
      }),
    );

    expect(currentPath()).toBe('/employees/87');
  });

  it('says there are no outliers instead of showing an empty table', async () => {
    await renderCountry('DE', 'Germany');

    const outliers = within(screen.getByRole('region', { name: 'Outliers' }));

    expect(outliers.getByLabelText('Number of outliers')).toHaveTextContent('0');
    expect(
      outliers.getByText(
        'No outliers in Germany. Everyone is within 25% of the median for their job title.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Outliers in Germany' })).not.toBeInTheDocument();
  });
});

describe('Country insights: countries without data', () => {
  it('shows "Country not found" for an unsupported code, without asking the API, with a link back', async () => {
    const { user } = renderApp('/insights/ZZ');

    expect(await screen.findByText('Country not found')).toBeVisible();
    expect(jobTitleRequests).toEqual([]);

    await user.click(screen.getByRole('link', { name: 'Back to Insights' }));

    expect(currentPath()).toBe('/insights');
  });

  it('treats a lowercase code as unsupported, since country codes are exact', async () => {
    renderApp('/insights/in');

    expect(await screen.findByText('Country not found')).toBeVisible();
  });

  it('says a supported country has no employees yet, instead of showing empty tables', async () => {
    renderApp('/insights/SG');

    expect(await screen.findByText('No employees in Singapore yet.')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Singapore' })).toBeVisible();
    expect(screen.getByText('0 employees · all amounts in SGD')).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Country insights: loading and failure', () => {
  it('shows a loading state until the figures arrive', async () => {
    server.use(
      http.get(COUNTRY_JOB_TITLES_URL, async () => {
        await delay(50);
        return HttpResponse.json(INDIA_JOB_TITLES);
      }),
    );

    renderApp('/insights/IN');

    expect(screen.getByText('Loading country insights')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
    expect(screen.queryByText('Loading country insights')).not.toBeInTheDocument();
  });

  it.each([
    { failing: 'the job titles', url: COUNTRY_JOB_TITLES_URL },
    { failing: 'the country figures', url: INSIGHTS_COUNTRIES_URL },
  ])('shows an error with Retry when $failing fail, and the page after it', async ({ url }) => {
    server.use(http.get(url, () => serverError(), { once: true }));

    const { user } = renderApp('/insights/IN');

    expect(await screen.findByText('Could not load insights')).toBeVisible();
    expect(screen.queryByText('Country not found')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
    expect(screen.getByText('4,200 employees · all amounts in INR')).toBeVisible();
  });
});
