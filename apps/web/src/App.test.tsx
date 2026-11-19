import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the app name as the page heading', () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ACME Salary Manager');
  });
});
