import { AppShell, Group, NavLink, Text } from '@mantine/core';
import { APP_NAME } from '@salary-manager/shared';
import { IconCalculator, IconChartBar, IconUsers } from '@tabler/icons-react';
import type { ReactElement } from 'react';
import { Outlet, NavLink as RouterNavLink, useLocation } from 'react-router';

const SECTIONS = [
  { path: '/employees', label: 'Employees', Icon: IconUsers },
  { path: '/insights', label: 'Insights', Icon: IconChartBar },
  { path: '/simulator', label: 'Raise simulator', Icon: IconCalculator },
];

export function AppLayout(): ReactElement {
  const { pathname } = useLocation();

  return (
    <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 0 }} padding="xl">
      <AppShell.Header>
        <Group h="100%" px="lg">
          <Text fw={700} size="lg">
            {APP_NAME}
          </Text>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="sm">
        {SECTIONS.map(({ path, label, Icon }) => (
          <NavLink
            key={path}
            component={RouterNavLink}
            to={path}
            label={label}
            leftSection={<Icon size={18} aria-hidden />}
            active={pathname === path || pathname.startsWith(`${path}/`)}
            fw={500}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main bg="gray.0">
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
