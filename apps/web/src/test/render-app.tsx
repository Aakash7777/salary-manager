import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type BoundFunctions, type queries, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { vi } from 'vitest';
import { AppRoutes } from '../AppRoutes';
import { theme } from '../theme';

/** Queries limited to one part of the page, as `within(element)` returns them. */
export type Scoped = BoundFunctions<typeof queries>;

/** Shows the router's current URL, so a test can assert on it like the address bar. */
function LocationProbe(): ReactElement {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

/**
 * Renders the real application at a URL, with the real providers.
 * Only the network is replaced (by MSW); no component is mocked.
 */
export function renderApp(initialUrl: string): { user: UserEvent } {
  // Retries are off so an error state appears at once instead of after the backoff.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    // env="test" turns off Mantine's transitions and portals, as its testing guide advises.
    <MantineProvider theme={theme} env="test">
      <Notifications />
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialUrl]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </QueryClientProvider>
    </MantineProvider>,
  );

  return { user: userEvent.setup() };
}

/**
 * Fixes "now" at noon on 19 November 2026 in the machine's own timezone, so the user's
 * local calendar date is 2026-11-19 wherever the tests run. Only the clock is faked:
 * timers still run for real, which MSW, TanStack Query and user-event rely on.
 */
export function freezeTodayAt19Nov2026(): void {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 19, 12, 0, 0) });
}

export const TODAY = '2026-11-19';
export const TOMORROW = '2026-11-20';

export function currentPath(): string {
  return (screen.getByTestId('location').textContent ?? '').split('?')[0] ?? '';
}

/** The query string of the current URL as an object, so tests don't depend on its order. */
export function currentParams(): Record<string, string> {
  const search = (screen.getByTestId('location').textContent ?? '').split('?')[1] ?? '';
  return Object.fromEntries(new URLSearchParams(search));
}
