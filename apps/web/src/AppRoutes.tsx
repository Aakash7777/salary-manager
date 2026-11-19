import type { ReactElement } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { EmployeeDetailPage } from './employees/EmployeeDetailPage';
import { EmployeesPage } from './employees/EmployeesPage';
import { CountryInsightsPage } from './insights/CountryInsightsPage';
import { InsightsPage } from './insights/InsightsPage';
import { AppLayout } from './layout/AppLayout';
import { NotFoundPage } from './pages/NotFoundPage';

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/employees" replace />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetailPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="insights/:countryCode" element={<CountryInsightsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
