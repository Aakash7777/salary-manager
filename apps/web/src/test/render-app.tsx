import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter, useLocation } from 'react-router';
import { AppRoutes } from '../AppRoutes';
import { theme } from '../theme';

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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    // env="test" turns off Mantine's transitions and portals, as its testing guide advises.
    <MantineProvider theme={theme} env="test">
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

export function currentPath(): string {
  return (screen.getByTestId('location').textContent ?? '').split('?')[0] ?? '';
}

/** The query string of the current URL as an object, so tests don't depend on its order. */
export function currentParams(): Record<string, string> {
  const search = (screen.getByTestId('location').textContent ?? '').split('?')[1] ?? '';
  return Object.fromEntries(new URLSearchParams(search));
}
