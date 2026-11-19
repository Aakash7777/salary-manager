import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { currentPath, renderApp } from '../test/render-app';
import { EMPLOYEE_URL, apiWrites, server, serverError } from '../test/server';

/** Clicks "Remove employee" on Priya's page and returns queries scoped to the confirmation. */
async function openRemoveConfirmation() {
  const { user } = renderApp('/employees/2');
  await screen.findByRole('heading', { level: 1, name: 'Priya Sharma' });
  await user.click(screen.getByRole('button', { name: 'Remove employee' }));
  const dialog = await screen.findByRole('dialog', { name: 'Remove employee' });
  return { user, dialog, confirmation: within(dialog) };
}

describe('Remove employee', () => {
  it('asks for confirmation first, naming the person and what is lost, and deletes nothing yet', async () => {
    const { dialog } = await openRemoveConfirmation();

    expect(dialog).toHaveTextContent('Priya Sharma');
    expect(dialog).toHaveTextContent(/salary history/i);
    expect(dialog).toHaveTextContent(/cannot be undone/i);
    expect(apiWrites).toEqual([]);
  });

  it('deletes nothing and stays on the page when the confirmation is cancelled', async () => {
    const { user, confirmation } = await openRemoveConfirmation();

    await user.click(confirmation.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Remove employee' })).not.toBeInTheDocument(),
    );
    expect(apiWrites).toEqual([]);
    expect(currentPath()).toBe('/employees/2');
  });

  it('deletes the employee after confirmation, returns to the directory and confirms', async () => {
    const { user, confirmation } = await openRemoveConfirmation();

    await user.click(confirmation.getByRole('button', { name: 'Yes, remove' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Employees' })).toBeVisible();
    expect(currentPath()).toBe('/employees');
    expect(apiWrites).toEqual([{ method: 'DELETE', path: '/api/employees/2', body: undefined }]);
    expect(screen.getByText('Employee removed')).toBeVisible();
  });

  it('stays on the page and reports the failure when the delete fails', async () => {
    server.use(http.delete(EMPLOYEE_URL, () => serverError()));
    const { user, confirmation } = await openRemoveConfirmation();

    await user.click(confirmation.getByRole('button', { name: 'Yes, remove' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeVisible();
    expect(currentPath()).toBe('/employees/2');
    expect(screen.getByRole('heading', { level: 1, name: 'Priya Sharma' })).toBeVisible();
  });
});
