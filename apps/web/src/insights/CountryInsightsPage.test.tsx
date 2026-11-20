import { screen, within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { currentParams, currentPath, goBack, renderApp } from '../test/render-app';
import {
  COUNTRY_JOB_TITLES_URL,
  INDIA_JOB_TITLES,
  INSIGHTS_COUNTRIES,
  INSIGHTS_COUNTRIES_URL,
  jobTitleRequests,
  server,
  serverError,
} from '../test/server';

// India in the fixture has 3 job titles and 2 outliers; Germany 1 and 0; Singapore nobody.
const INDIA_JOB_TITLES_TAB = 'Pay by job title (3)';
const INDIA_OUTLIERS_TAB = 'Outliers (2)';

/** Opens a country on its default tab and waits for the job-title table. */
async function renderCountry(code: string, countryName: string) {
  const rendered = renderApp(`/insights/${code}`);
  await screen.findByRole('table', { name: `Pay by job title in ${countryName}` });
  return rendered;
}

/** Opens a country straight on its Outliers tab, as a shared link would, and waits for it. */
async function renderOutliersTab(code: string) {
  const rendered = renderApp(`/insights/${code}?tab=outliers`);
  await screen.findByRole('tab', { name: /^Outliers \(/, selected: true });
  return rendered;
}

function tabLabels(): (string | null)[] {
  return within(screen.getByRole('tablist'))
    .getAllByRole('tab')
    .map((tab) => tab.textContent);
}

function selectedTab(): string | null {
  return screen.getByRole('tab', { selected: true }).textContent;
}

function firstCells(table: HTMLElement): (string | null | undefined)[] {
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0]?.textContent);
}

function expectIndiaHeader(): void {
  const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' });
  expect(within(breadcrumb).getByRole('link', { name: 'Insights' })).toHaveAttribute(
    'href',
    '/insights',
  );
  expect(within(breadcrumb).getByText('India')).toBeVisible();
  expect(screen.getByRole('heading', { level: 1, name: 'India' })).toBeVisible();
  expect(screen.getByText('4,200 employees · all amounts in INR')).toBeVisible();
  const summary = screen.getByRole('region', { name: 'Country summary' });
  expect(within(summary).getByLabelText('Median')).toHaveTextContent('INR 17,50,000');
  expect(within(summary).getByLabelText('Average')).toHaveTextContent('INR 18,69,300');
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

    expectIndiaHeader();
  });

  it('keeps the breadcrumb, heading, headcount, currency, median and average above the tabs on either tab', async () => {
    const { user } = await renderCountry('IN', 'India');

    await user.click(screen.getByRole('tab', { name: INDIA_OUTLIERS_TAB }));

    expect(screen.getByRole('table', { name: 'Outliers in India' })).toBeVisible();
    expectIndiaHeader();
    // "Above": the summary comes before the tabs in the page.
    const summary = screen.getByRole('region', { name: 'Country summary' });
    expect(
      summary.compareDocumentPosition(screen.getByRole('tablist')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe('Country insights: tabs', () => {
  it('has two tabs, "Pay by job title" then "Outliers", each with its count in the label', async () => {
    await renderCountry('IN', 'India');

    expect(tabLabels()).toEqual([INDIA_JOB_TITLES_TAB, INDIA_OUTLIERS_TAB]);
  });

  it('writes large counts with thousands separators', async () => {
    const [engineer] = INDIA_JOB_TITLES.jobTitles;
    const [neha] = INDIA_JOB_TITLES.outliers;
    server.use(
      http.get(COUNTRY_JOB_TITLES_URL, () =>
        HttpResponse.json({
          ...INDIA_JOB_TITLES,
          jobTitles: Array.from({ length: 38 }, (_, index) => ({
            ...engineer,
            jobTitle: `Job title ${index + 1}`,
          })),
          outliers: Array.from({ length: 1_420 }, (_, index) => ({
            ...neha,
            employeeId: index + 1,
          })),
        }),
      ),
    );

    await renderCountry('IN', 'India');

    expect(tabLabels()).toEqual(['Pay by job title (38)', 'Outliers (1,420)']);
  });

  it('opens on "Pay by job title" by default, with nothing about the tab in the URL', async () => {
    await renderCountry('IN', 'India');

    expect(selectedTab()).toBe(INDIA_JOB_TITLES_TAB);
    expect(screen.getByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Outliers in India' })).not.toBeInTheDocument();
    expect(currentParams()).toEqual({});
  });

  it('switches to the outliers when the Outliers tab is clicked, and puts the tab in the URL', async () => {
    const { user } = await renderCountry('IN', 'India');

    await user.click(screen.getByRole('tab', { name: INDIA_OUTLIERS_TAB }));

    expect(selectedTab()).toBe(INDIA_OUTLIERS_TAB);
    expect(screen.getByRole('table', { name: 'Outliers in India' })).toBeVisible();
    expect(
      screen.queryByRole('table', { name: 'Pay by job title in India' }),
    ).not.toBeInTheDocument();
    expect(currentPath()).toBe('/insights/IN');
    expect(currentParams()).toEqual({ tab: 'outliers' });
  });

  it('switches back to "Pay by job title" and takes the tab out of the URL again', async () => {
    const { user } = await renderOutliersTab('IN');

    await user.click(screen.getByRole('tab', { name: INDIA_JOB_TITLES_TAB }));

    expect(selectedTab()).toBe(INDIA_JOB_TITLES_TAB);
    expect(screen.getByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
    expect(currentParams()).toEqual({});
  });

  it('opens straight on the outliers when the URL says ?tab=outliers', async () => {
    await renderOutliersTab('IN');

    expect(selectedTab()).toBe(INDIA_OUTLIERS_TAB);
    expect(screen.getByRole('table', { name: 'Outliers in India' })).toBeVisible();
    expect(
      screen.queryByRole('table', { name: 'Pay by job title in India' }),
    ).not.toBeInTheDocument();
    expect(currentParams()).toEqual({ tab: 'outliers' });
  });

  it('opens on "Pay by job title" when the URL names a tab that does not exist', async () => {
    renderApp('/insights/IN?tab=payroll');

    expect(await screen.findByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
    expect(selectedTab()).toBe(INDIA_JOB_TITLES_TAB);
  });

  it('returns to the previous tab when Back is pressed', async () => {
    const { user } = await renderCountry('IN', 'India');
    await user.click(screen.getByRole('tab', { name: INDIA_OUTLIERS_TAB }));
    expect(selectedTab()).toBe(INDIA_OUTLIERS_TAB);

    await goBack();

    expect(selectedTab()).toBe(INDIA_JOB_TITLES_TAB);
    expect(screen.getByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
    expect(currentParams()).toEqual({});
  });

  it('comes back to the Outliers tab after visiting an employee’s profile', async () => {
    const { user } = await renderOutliersTab('IN');
    await user.click(screen.getAllByRole('link', { name: 'View profile' })[0] as HTMLElement);
    expect(currentPath()).toBe('/employees/41');

    await goBack();

    expect(await screen.findByRole('table', { name: 'Outliers in India' })).toBeVisible();
    expect(selectedTab()).toBe(INDIA_OUTLIERS_TAB);
    expect(currentParams()).toEqual({ tab: 'outliers' });
  });

  it('moves between the tabs with the arrow keys', async () => {
    const { user } = await renderCountry('IN', 'India');

    screen.getByRole('tab', { name: INDIA_JOB_TITLES_TAB }).focus();
    await user.keyboard('{ArrowRight}');

    expect(selectedTab()).toBe(INDIA_OUTLIERS_TAB);
    expect(screen.getByRole('table', { name: 'Outliers in India' })).toBeVisible();
    expect(currentParams()).toEqual({ tab: 'outliers' });
  });

  it('makes no new request when the tab changes: both tabs come from the one already made', async () => {
    let countryFigureRequests = 0;
    server.use(
      http.get(INSIGHTS_COUNTRIES_URL, () => {
        countryFigureRequests += 1;
        return HttpResponse.json(INSIGHTS_COUNTRIES);
      }),
    );
    const { user } = await renderCountry('IN', 'India');
    expect(jobTitleRequests).toEqual(['IN']);
    expect(countryFigureRequests).toBe(1);

    await user.click(screen.getByRole('tab', { name: INDIA_OUTLIERS_TAB }));
    expect(screen.getByRole('table', { name: 'Outliers in India' })).toBeVisible();
    await user.click(screen.getByRole('tab', { name: INDIA_JOB_TITLES_TAB }));
    await user.click(screen.getByRole('tab', { name: INDIA_OUTLIERS_TAB }));
    // Long enough for a request to have gone out, had switching caused one.
    await delay(50);

    expect(jobTitleRequests).toEqual(['IN']);
    expect(countryFigureRequests).toBe(1);
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

  it('puts the table inside the "Pay by job title" tab', async () => {
    await renderCountry('IN', 'India');

    const panel = screen.getByRole('tabpanel', { name: INDIA_JOB_TITLES_TAB });

    expect(within(panel).getByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
  });
});

describe('Country insights: outliers', () => {
  it('says what makes someone an outlier, inside the Outliers tab', async () => {
    await renderOutliersTab('IN');

    const panel = within(screen.getByRole('tabpanel', { name: INDIA_OUTLIERS_TAB }));

    expect(
      panel.getByText('Paid more than 25% above or below the median for their job title in India.'),
    ).toBeVisible();
    expect(panel.getByRole('table', { name: 'Outliers in India' })).toBeVisible();
  });

  it('shows an outlier above the median with their salary, the role median and an "above" badge', async () => {
    await renderOutliersTab('IN');
    const table = within(screen.getByRole('table', { name: 'Outliers in India' }));

    const neha = within(table.getByRole('row', { name: /Neha Kapoor/ }));

    expect(neha.getByText('NK')).toBeInTheDocument();
    expect(neha.getByText('Engineer')).toBeVisible();
    expect(neha.getByText('INR 20,00,000')).toBeVisible();
    expect(neha.getByText('INR 12,60,000')).toBeVisible();
    expect(neha.getByText('58.7% above')).toBeVisible();
  });

  it('shows an outlier below the median with a "below" badge', async () => {
    await renderOutliersTab('IN');
    const table = within(screen.getByRole('table', { name: 'Outliers in India' }));

    const aarav = within(table.getByRole('row', { name: /Aarav Mehta/ }));

    expect(aarav.getByText('Senior Engineer')).toBeVisible();
    expect(aarav.getByText('INR 18,00,000')).toBeVisible();
    expect(aarav.getByText('INR 26,10,000')).toBeVisible();
    expect(aarav.getByText('31.0% below')).toBeVisible();
  });

  it('lists the outliers with the largest gap first, as the API orders them', async () => {
    await renderOutliersTab('IN');

    const names = within(screen.getByRole('table', { name: 'Outliers in India' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => within(row).getByRole('link', { name: 'View profile' }).getAttribute('href'));

    expect(names).toEqual(['/employees/41', '/employees/87']);
  });

  it('opens the employee’s profile from "View profile"', async () => {
    const { user } = await renderOutliersTab('IN');
    const table = within(screen.getByRole('table', { name: 'Outliers in India' }));

    await user.click(
      within(table.getByRole('row', { name: /Aarav Mehta/ })).getByRole('link', {
        name: 'View profile',
      }),
    );

    expect(currentPath()).toBe('/employees/87');
  });
});

describe('Country insights: a country with no outliers', () => {
  it('counts zero outliers in the tab label, and still shows the job titles', async () => {
    await renderCountry('DE', 'Germany');

    expect(tabLabels()).toEqual(['Pay by job title (1)', 'Outliers (0)']);
    expect(screen.getByRole('table', { name: 'Pay by job title in Germany' })).toBeVisible();
  });

  it('says there are no outliers inside the Outliers tab, instead of showing an empty table', async () => {
    const { user } = await renderCountry('DE', 'Germany');

    await user.click(screen.getByRole('tab', { name: 'Outliers (0)' }));

    const panel = within(screen.getByRole('tabpanel', { name: 'Outliers (0)' }));
    expect(
      panel.getByText(
        'No outliers in Germany. Everyone is within 25% of the median for their job title.',
      ),
    ).toBeVisible();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the no-outliers message when a link opens the Outliers tab of a country that has none', async () => {
    await renderOutliersTab('DE');

    expect(
      screen.getByText(
        'No outliers in Germany. Everyone is within 25% of the median for their job title.',
      ),
    ).toBeVisible();
  });
});

describe('Country insights: a country with no employees', () => {
  it('shows the page-level "No employees yet" message and no tabs at all', async () => {
    renderApp('/insights/SG');

    expect(await screen.findByText('No employees in Singapore yet.')).toBeVisible();
    expect(
      screen.getByText('Pay figures appear here once someone is added in this country.'),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Singapore' })).toBeVisible();
    expect(screen.getByText('0 employees · all amounts in SGD')).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the same message, still with no tabs, when the URL asks for the Outliers tab', async () => {
    renderApp('/insights/SG?tab=outliers');

    expect(await screen.findByText('No employees in Singapore yet.')).toBeVisible();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByText(/No outliers in Singapore/)).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('Country insights: countries that do not exist', () => {
  it('shows "Country not found" for an unsupported code, without asking the API, with a link back', async () => {
    const { user } = renderApp('/insights/ZZ');

    expect(await screen.findByText('Country not found')).toBeVisible();
    expect(jobTitleRequests).toEqual([]);
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Back to Insights' }));

    expect(currentPath()).toBe('/insights');
  });

  it('treats a lowercase code as unsupported, since country codes are exact', async () => {
    renderApp('/insights/in');

    expect(await screen.findByText('Country not found')).toBeVisible();
  });
});

describe('Country insights: loading and failure', () => {
  it('shows a loading state, and no tabs, until the figures arrive', async () => {
    server.use(
      http.get(COUNTRY_JOB_TITLES_URL, async () => {
        await delay(50);
        return HttpResponse.json(INDIA_JOB_TITLES);
      }),
    );

    renderApp('/insights/IN');

    expect(screen.getByText('Loading country insights')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
    expect(screen.queryByText('Loading country insights')).not.toBeInTheDocument();
    expect(tabLabels()).toEqual([INDIA_JOB_TITLES_TAB, INDIA_OUTLIERS_TAB]);
  });

  it.each([
    { failing: 'the job titles', url: COUNTRY_JOB_TITLES_URL },
    { failing: 'the country figures', url: INSIGHTS_COUNTRIES_URL },
  ])('shows an error with Retry when $failing fail, and the page after it', async ({ url }) => {
    server.use(http.get(url, () => serverError(), { once: true }));

    const { user } = renderApp('/insights/IN');

    expect(await screen.findByText('Could not load insights')).toBeVisible();
    expect(screen.queryByText('Country not found')).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table', { name: 'Pay by job title in India' })).toBeVisible();
    expect(screen.getByText('4,200 employees · all amounts in INR')).toBeVisible();
  });

  it('opens on the tab the URL asked for once a failed load is retried', async () => {
    server.use(http.get(COUNTRY_JOB_TITLES_URL, () => serverError(), { once: true }));

    const { user } = renderApp('/insights/IN?tab=outliers');

    expect(await screen.findByText('Could not load insights')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table', { name: 'Outliers in India' })).toBeVisible();
    expect(selectedTab()).toBe(INDIA_OUTLIERS_TAB);
  });
});
