import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { EmployeesPage } from './employees/EmployeesPage';
import { AppLayout } from './layout/AppLayout';
import { NotFoundPage } from './pages/NotFoundPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<PlaceholderPage title="Employee details" />} />
        <Route path="insights" element={<PlaceholderPage title="Insights" />} />
        <Route
          path="insights/:countryCode"
          element={<PlaceholderPage title="Country insights" />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
