import { screen, within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { currentPath, renderApp } from '../test/render-app';
import {
  INSIGHTS_COUNTRIES,
  INSIGHTS_COUNTRIES_URL,
  INSIGHTS_SUMMARY,
  INSIGHTS_SUMMARY_URL,
  server,
  serverError,
} from '../test/server';

async function renderInsights() {
  const rendered = renderApp('/insights');
  await screen.findByRole('table', { name: 'Pay by country' });
  return rendered;
}

function card(name: string) {
  return within(screen.getByRole('region', { name }));
}

describe('Insights overview: summary cards', () => {
  it('has the title and what the page is about', async () => {
    await renderInsights();

    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible();
    expect(screen.getByText('How ACME pays people, by country and role.')).toBeVisible();
  });

  it('shows the total headcount', async () => {
    await renderInsights();

    expect(card('Total headcount').getByText('7,950')).toBeVisible();
    expect(card('Total headcount').getByText('employees')).toBeVisible();
  });

  it('shows the number of countries and of currencies', async () => {
    await renderInsights();

    expect(card('Countries').getByText('3')).toBeVisible();
    expect(card('Countries').getByText('3 currencies')).toBeVisible();
  });

  it('counts each currency once when two countries share it', async () => {
    const [india, unitedStates, germany] = INSIGHTS_COUNTRIES;
    const austria = { ...germany, code: 'AT', name: 'Austria' };
    server.use(
      http.get(INSIGHTS_COUNTRIES_URL, () =>
        HttpResponse.json([india, unitedStates, germany, austria]),
      ),
      http.get(INSIGHTS_SUMMARY_URL, () =>
        HttpResponse.json({ ...INSIGHTS_SUMMARY, countryCount: 4 }),
      ),
    );

    await renderInsights();

    expect(card('Countries').getByText('4')).toBeVisible();
    expect(card('Countries').getByText('3 currencies')).toBeVisible();
  });

  it('shows the number of departments and of job titles', async () => {
    await renderInsights();

    expect(card('Departments').getByText('8')).toBeVisible();
    expect(card('Departments').getByText('60 job titles')).toBeVisible();
  });

  it('shows the payroll as an approximate USD figure, labelled indicative, with the FX table version', async () => {
    await renderInsights();

    const payroll = card('Total annual payroll');

    // USD 662,797,585 from the API.
    expect(payroll.getByText('≈ USD 663M')).toBeVisible();
    expect(payroll.getByText('Converted with fixed rates, indicative only')).toBeVisible();
    expect(payroll.getByText('FX table 2026-11')).toBeVisible();
  });
});

describe('Insights overview: pay by country', () => {
  it('shows each country in its own currency', async () => {
    await renderInsights();
    const table = within(screen.getByRole('table', { name: 'Pay by country' }));

    const india = within(table.getByRole('row', { name: /India/ }));
    expect(india.getByText('INR')).toBeVisible();
    expect(india.getByText('4,200')).toBeVisible();
    expect(india.getByText('INR 5,75,000')).toBeVisible();
    expect(india.getByText('INR 17,50,000')).toBeVisible();
    expect(india.getByText('INR 18,69,300')).toBeVisible();
    expect(india.getByText('INR 51,70,000')).toBeVisible();

    const unitedStates = within(table.getByRole('row', { name: /United States/ }));
    expect(unitedStates.getByText('USD')).toBeVisible();
    expect(unitedStates.getByText('2,650')).toBeVisible();
    expect(unitedStates.getByText('USD 38,000')).toBeVisible();
    expect(unitedStates.getByText('USD 117,000')).toBeVisible();
    expect(unitedStates.getByText('USD 124,857')).toBeVisible();
    expect(unitedStates.getByText('USD 380,500')).toBeVisible();

    const germany = within(table.getByRole('row', { name: /Germany/ }));
    expect(germany.getByText('EUR')).toBeVisible();
    expect(germany.getByText('EUR 66,500')).toBeVisible();
  });

  it('has the columns in the agreed order', async () => {
    await renderInsights();

    const headers = within(screen.getByRole('table', { name: 'Pay by country' }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent);

    expect(headers.slice(0, 7)).toEqual([
      'Country',
      'Currency',
      'Headcount',
      'Min',
      'Median',
      'Average',
      'Max',
    ]);
  });

  it('lists the countries in the order the API gives, largest headcount first', async () => {
    await renderInsights();

    const rows = within(screen.getByRole('table', { name: 'Pay by country' }))
      .getAllByRole('row')
      .slice(1);

    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'India',
      'United States',
      'Germany',
    ]);
  });

  it('opens the country’s drill-down when its row is clicked', async () => {
    const { user } = await renderInsights();

    await user.click(screen.getByRole('row', { name: /United States/ }));

    expect(currentPath()).toBe('/insights/US');
  });

  it('also links each country name to its drill-down, for keyboard use', async () => {
    await renderInsights();

    expect(screen.getByRole('link', { name: 'India' })).toHaveAttribute('href', '/insights/IN');
  });

  it('warns that the rows are in different currencies', async () => {
    await renderInsights();

    expect(
      screen.getByText(
        'Rows are in different currencies and are not directly comparable. Only the payroll total above is converted.',
      ),
    ).toBeVisible();
  });
});

describe('Insights overview: loading and failure', () => {
  it('shows a loading state until the figures arrive', async () => {
    server.use(
      http.get(INSIGHTS_SUMMARY_URL, async () => {
        await delay(50);
        return HttpResponse.json(INSIGHTS_SUMMARY);
      }),
    );

    renderApp('/insights');

    expect(screen.getByText('Loading insights')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Pay by country' })).toBeVisible();
    expect(screen.queryByText('Loading insights')).not.toBeInTheDocument();
  });

  it.each([
    { failing: 'the summary', url: INSIGHTS_SUMMARY_URL },
    { failing: 'the country table', url: INSIGHTS_COUNTRIES_URL },
  ])('shows an error with Retry when $failing fails, and the page after it', async ({ url }) => {
    server.use(http.get(url, () => serverError(), { once: true }));

    const { user } = renderApp('/insights');

    expect(await screen.findByText('Could not load insights')).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Pay by country' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table', { name: 'Pay by country' })).toBeVisible();
    expect(card('Total headcount').getByText('7,950')).toBeVisible();
    expect(screen.queryByText('Could not load insights')).not.toBeInTheDocument();
  });
});
