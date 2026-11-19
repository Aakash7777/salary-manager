import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { currentPath, renderApp } from './test/render-app';

describe('app shell', () => {
  it('shows the app name in the header, with no search box and no user menu', async () => {
    renderApp('/employees');

    const header = screen.getByRole('banner');

    expect(within(header).getByText('ACME Salary Manager')).toBeInTheDocument();
    expect(within(header).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(header).queryByRole('searchbox')).not.toBeInTheDocument();
    expect(within(header).queryByRole('button')).not.toBeInTheDocument();
    await screen.findByRole('heading', { level: 1, name: 'Employees' });
  });

  it('links to Employees and Insights from the sidebar', () => {
    renderApp('/employees');

    const nav = screen.getByRole('navigation');

    expect(within(nav).getByRole('link', { name: 'Employees' })).toHaveAttribute(
      'href',
      '/employees',
    );
    expect(within(nav).getByRole('link', { name: 'Insights' })).toHaveAttribute(
      'href',
      '/insights',
    );
  });

  it('marks the current section in the sidebar', () => {
    renderApp('/insights');

    const nav = screen.getByRole('navigation');

    expect(within(nav).getByRole('link', { name: 'Insights' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Employees' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('redirects / to the Employees directory', async () => {
    renderApp('/');

    expect(await screen.findByRole('heading', { level: 1, name: 'Employees' })).toBeVisible();
    expect(currentPath()).toBe('/employees');
  });

  it('goes to the Insights page from the sidebar', async () => {
    const { user } = renderApp('/employees');

    await user.click(screen.getByRole('link', { name: 'Insights' }));

    expect(screen.getByRole('heading', { level: 1, name: 'Insights' })).toBeVisible();
    expect(currentPath()).toBe('/insights');
  });

  it.each([
    { url: '/insights', heading: 'Insights' },
    { url: '/insights/IN', heading: 'Country insights' },
  ])('has a page at $url', ({ url, heading }) => {
    renderApp(url);

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  });

  it('shows a Not found page for an unknown address, with a way back to Employees', async () => {
    const { user } = renderApp('/payroll/2026');

    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible();

    await user.click(screen.getByRole('link', { name: 'Go to Employees' }));

    expect(currentPath()).toBe('/employees');
  });
});
