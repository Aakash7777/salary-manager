import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { currentParams, renderApp } from '../test/render-app';
import {
  NOBODY_MATCHES,
  SIMULATE_RAISE_URL,
  SIMULATION,
  apiWrites,
  invalidInput,
  lastSimulationRequest,
  server,
  serverError,
  simulationRequests,
} from '../test/server';

const RESULTS_TABLE = 'Cost of the raise by currency';

async function renderSimulator(url = '/simulator') {
  const rendered = renderApp(url);
  await screen.findByRole('table', { name: RESULTS_TABLE });
  return rendered;
}

function percentageInput() {
  return screen.getByRole('textbox', { name: 'Raise' });
}

function percentageSlider() {
  return screen.getByRole('slider', { name: 'Raise percentage' });
}

describe('Raise simulator: the page', () => {
  it('has the title and says it is a preview that changes nothing', async () => {
    await renderSimulator();

    expect(screen.getByRole('heading', { level: 1, name: 'Raise simulator' })).toBeVisible();
    expect(
      screen.getByText('See what a raise would cost for any group of employees.'),
    ).toBeVisible();
    expect(
      screen.getByText('This is a preview only. Nothing is saved and no salary is changed.'),
    ).toBeVisible();
  });

  it('starts with everyone and a raise of 0%', async () => {
    await renderSimulator();

    expect(simulationRequests).toEqual([{ filters: {}, pct: 0 }]);
    expect(percentageInput()).toHaveValue('0%');
    expect(percentageSlider()).toHaveAttribute('aria-valuenow', '0');
    expect(percentageSlider()).toHaveAttribute('aria-valuemin', '0');
    expect(percentageSlider()).toHaveAttribute('aria-valuemax', '50');
  });

  it('offers the directory’s filter controls', async () => {
    await renderSimulator();

    expect(screen.getByRole('textbox', { name: 'Search by name or email' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Country' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Department' })).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Job title' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeVisible();
  });
});

describe('Raise simulator: results', () => {
  it('says how many employees match', async () => {
    await renderSimulator();

    expect(screen.getByText('6,850 employees match')).toBeVisible();
  });

  it('says "1 employee matches" for one', async () => {
    const [euros] = SIMULATION.byCurrency;
    server.use(
      http.post(SIMULATE_RAISE_URL, () =>
        HttpResponse.json({
          ...SIMULATION,
          headcount: 1,
          byCurrency: [{ ...euros, headcount: 1 }],
        }),
      ),
    );

    await renderSimulator();

    expect(screen.getByText('1 employee matches')).toBeVisible();
  });

  it('has the columns in the agreed order', async () => {
    await renderSimulator();

    const headers = within(screen.getByRole('table', { name: RESULTS_TABLE }))
      .getAllByRole('columnheader')
      .map((header) => header.textContent);

    expect(headers).toEqual(['Currency', 'Employees', 'Current total', 'Increase', 'New total']);
  });

  it('shows one row per currency, each in its own currency', async () => {
    await renderSimulator();
    const table = within(screen.getByRole('table', { name: RESULTS_TABLE }));
    const cellsOf = (currency: string) =>
      within(table.getByRole('row', { name: new RegExp(`^${currency}`) }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent);

    expect(cellsOf('EUR')).toEqual([
      'EUR',
      '1,100',
      'EUR 78,320,000',
      'EUR 6,265,600',
      'EUR 84,585,600',
    ]);
    expect(cellsOf('INR')).toEqual([
      'INR',
      '4,200',
      'INR 7,85,10,60,000',
      'INR 62,80,84,800',
      'INR 8,47,91,44,800',
    ]);
    expect(cellsOf('USD')).toEqual([
      'USD',
      '1,550',
      'USD 193,500,000',
      'USD 15,480,000',
      'USD 208,980,000',
    ]);
  });

  it('lists the currencies in the order the API gives', async () => {
    await renderSimulator();

    const rows = within(screen.getByRole('table', { name: RESULTS_TABLE }))
      .getAllByRole('row')
      .slice(1);

    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'EUR',
      'INR',
      'USD',
    ]);
  });

  it('shows the total increase as an approximate USD figure, labelled indicative, with the FX table version', async () => {
    await renderSimulator();

    // USD 29,783,865.60 from the API, rounded to whole dollars.
    expect(screen.getByText('Total increase ≈ USD 29,783,866, indicative only')).toBeVisible();
    expect(screen.getByText('Converted with fixed rates. FX table 2026-11')).toBeVisible();
  });

  it('never shows a total that adds the local currencies together', async () => {
    await renderSimulator();

    const table = within(screen.getByRole('table', { name: RESULTS_TABLE }));

    // Header + three currencies: no "Total" row under columns that are in different currencies.
    expect(table.getAllByRole('row')).toHaveLength(4);
    expect(table.queryByText(/^total$/i)).not.toBeInTheDocument();
  });
});

describe('Raise simulator: choosing the percentage', () => {
  it('sends the typed percentage once, after typing stops, and puts it in the URL', async () => {
    const { user } = await renderSimulator();

    await user.clear(percentageInput());
    await user.type(percentageInput(), '12.5');

    await waitFor(() => expect(lastSimulationRequest()).toEqual({ filters: {}, pct: 12.5 }));
    // The first request is the page loading at 0%. None for "1", "12" or "12.".
    expect(simulationRequests.map((request) => request.pct)).toEqual([0, 12.5]);
    expect(currentParams()).toEqual({ pct: '12.5' });
    expect(percentageInput()).toHaveValue('12.5%');
  });

  it('moves the slider to the typed percentage', async () => {
    const { user } = await renderSimulator();

    await user.clear(percentageInput());
    await user.type(percentageInput(), '8');

    await waitFor(() => expect(percentageSlider()).toHaveAttribute('aria-valuenow', '8'));
  });

  it('does not let more than 50 be typed', async () => {
    const { user } = await renderSimulator();

    await user.clear(percentageInput());
    await user.type(percentageInput(), '60');

    // The 0 that would make it 60 is refused, leaving 6.
    expect(percentageInput()).toHaveValue('6%');
    await waitFor(() => expect(lastSimulationRequest()).toEqual({ filters: {}, pct: 6 }));
  });

  it('does not let a second decimal be typed', async () => {
    const { user } = await renderSimulator();

    await user.clear(percentageInput());
    await user.type(percentageInput(), '8.25');

    expect(percentageInput()).toHaveValue('8.2%');
    await waitFor(() => expect(lastSimulationRequest()).toEqual({ filters: {}, pct: 8.2 }));
  });

  it('sends nothing while the percentage box is empty', async () => {
    const { user } = await renderSimulator();

    await user.clear(percentageInput());
    // Longer than the typing pause, so a request would have gone out by now.
    await delay(400);

    expect(simulationRequests).toEqual([{ filters: {}, pct: 0 }]);
  });

  it('moves in steps of 0.1 with the slider, and sends the percentage it lands on', async () => {
    const { user } = await renderSimulator('/simulator?pct=8');

    percentageSlider().focus();
    await user.keyboard('{ArrowRight}');

    await waitFor(() => expect(lastSimulationRequest()).toEqual({ filters: {}, pct: 8.1 }));
    expect(percentageInput()).toHaveValue('8.1%');
    expect(currentParams()).toEqual({ pct: '8.1' });
  });

  it('goes to 50% at the end of the slider and to 0% at the start', async () => {
    const { user } = await renderSimulator('/simulator?pct=8');

    percentageSlider().focus();
    await user.keyboard('{End}');

    await waitFor(() => expect(lastSimulationRequest()).toEqual({ filters: {}, pct: 50 }));
    expect(percentageInput()).toHaveValue('50%');

    await user.keyboard('{Home}');

    await waitFor(() => expect(lastSimulationRequest()).toEqual({ filters: {}, pct: 0 }));
    expect(percentageInput()).toHaveValue('0%');
    expect(currentParams()).toEqual({});
  });
});

describe('Raise simulator: choosing the group', () => {
  it('sends the chosen country and puts it in the URL', async () => {
    const { user } = await renderSimulator('/simulator?pct=8');

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'India' }));

    await waitFor(() =>
      expect(lastSimulationRequest()).toEqual({ filters: { country: 'IN' }, pct: 8 }),
    );
    expect(currentParams()).toEqual({ country: 'IN', pct: '8' });
  });

  it('offers the departments and job titles from the API, and sends the ones chosen', async () => {
    const { user } = await renderSimulator();

    await user.click(screen.getByRole('combobox', { name: 'Department' }));
    await user.click(await screen.findByRole('option', { name: 'Finance' }));
    await user.click(screen.getByRole('combobox', { name: 'Job title' }));
    await user.click(await screen.findByRole('option', { name: 'Analyst' }));

    await waitFor(() =>
      expect(lastSimulationRequest()).toEqual({
        filters: { department: 'Finance', jobTitle: 'Analyst' },
        pct: 0,
      }),
    );
    expect(currentParams()).toEqual({ department: 'Finance', jobTitle: 'Analyst' });
  });

  it('sends the search text once, after typing stops', async () => {
    const { user } = await renderSimulator();

    await user.type(screen.getByRole('textbox', { name: 'Search by name or email' }), 'priya');

    await waitFor(() =>
      expect(lastSimulationRequest()).toEqual({ filters: { search: 'priya' }, pct: 0 }),
    );
    expect(simulationRequests).toHaveLength(2);
    expect(currentParams()).toEqual({ search: 'priya' });
  });

  it('reads the filters and the percentage from the URL when the page loads', async () => {
    await renderSimulator(
      '/simulator?search=sharma&country=IN&department=Engineering&jobTitle=Senior%20Engineer&pct=8',
    );

    expect(simulationRequests).toEqual([
      {
        filters: {
          search: 'sharma',
          country: 'IN',
          department: 'Engineering',
          jobTitle: 'Senior Engineer',
        },
        pct: 8,
      },
    ]);
    expect(screen.getByRole('textbox', { name: 'Search by name or email' })).toHaveValue('sharma');
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('India');
    expect(screen.getByRole('combobox', { name: 'Department' })).toHaveValue('Engineering');
    expect(screen.getByRole('combobox', { name: 'Job title' })).toHaveValue('Senior Engineer');
    expect(percentageInput()).toHaveValue('8%');
    expect(percentageSlider()).toHaveAttribute('aria-valuenow', '8');
  });

  it('starts at 0% when the URL holds a percentage that is not allowed', async () => {
    await renderSimulator('/simulator?country=IN&pct=99');

    expect(simulationRequests).toEqual([{ filters: { country: 'IN' }, pct: 0 }]);
    expect(percentageInput()).toHaveValue('0%');
  });

  it('clears the filters but keeps the percentage', async () => {
    const { user } = await renderSimulator('/simulator?country=IN&department=Engineering&pct=8');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(lastSimulationRequest()).toEqual({ filters: {}, pct: 8 }));
    expect(currentParams()).toEqual({ pct: '8' });
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveValue('');
    expect(percentageInput()).toHaveValue('8%');
  });

  it('only ever asks for a simulation: it makes no request that writes', async () => {
    const { user } = await renderSimulator('/simulator?pct=8');

    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'India' }));
    await waitFor(() => expect(simulationRequests).toHaveLength(2));

    expect(apiWrites).toEqual([]);
    expect(screen.queryByRole('button', { name: /apply|save/i })).not.toBeInTheDocument();
  });
});

describe('Raise simulator: empty, loading and failure', () => {
  it('shows an empty state instead of the table when nobody matches', async () => {
    server.use(http.post(SIMULATE_RAISE_URL, () => HttpResponse.json(NOBODY_MATCHES)));

    renderApp('/simulator?country=SG&pct=8');

    expect(await screen.findByText('No employees match')).toBeVisible();
    expect(
      screen.getByText('Change or clear the filters to see what a raise would cost.'),
    ).toBeVisible();
    expect(screen.queryByRole('table', { name: RESULTS_TABLE })).not.toBeInTheDocument();
    expect(screen.queryByText(/Total increase/)).not.toBeInTheDocument();
    // The controls stay, so the way out of the empty state is on the page.
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeVisible();
    expect(percentageInput()).toHaveValue('8%');
  });

  it('shows a loading state until the first result arrives', async () => {
    server.use(
      http.post(SIMULATE_RAISE_URL, async () => {
        await delay(50);
        return HttpResponse.json(SIMULATION);
      }),
    );

    renderApp('/simulator');

    expect(screen.getByText('Calculating')).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: RESULTS_TABLE })).toBeVisible();
    expect(screen.queryByText('Calculating')).not.toBeInTheDocument();
  });

  it('shows an error with Retry when the simulation fails, and the result after it', async () => {
    server.use(http.post(SIMULATE_RAISE_URL, () => serverError(), { once: true }));

    const { user } = renderApp('/simulator?pct=8');

    expect(await screen.findByText('Could not run the simulation')).toBeVisible();
    expect(screen.queryByRole('table', { name: RESULTS_TABLE })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('table', { name: RESULTS_TABLE })).toBeVisible();
    expect(screen.queryByText('Could not run the simulation')).not.toBeInTheDocument();
  });

  it('shows the error state, with the controls still usable, when the API rejects a filter from the URL', async () => {
    server.use(
      http.post(SIMULATE_RAISE_URL, async ({ request }) => {
        const body = (await request.json()) as { filters?: { country?: string } };
        return body.filters?.country === 'ZZ'
          ? invalidInput([{ path: 'filters.country', message: 'Select a supported country' }])
          : HttpResponse.json(SIMULATION);
      }),
    );

    const { user } = renderApp('/simulator?country=ZZ&pct=8');

    expect(await screen.findByText('Could not run the simulation')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByRole('table', { name: RESULTS_TABLE })).toBeVisible();
    expect(currentParams()).toEqual({ pct: '8' });
  });
});
