import { Button, Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';
import { Link } from 'react-router';

export function NotFoundPage(): ReactElement {
  return (
    <Stack gap="lg">
      <Title order={1} size="h2">
        Page not found
      </Title>
      <Paper withBorder p="xl">
        <Stack align="flex-start" gap="md">
          <Text c="dimmed">There is nothing at this address.</Text>
          <Button component={Link} to="/employees" variant="light">
            Go to Employees
          </Button>
        </Stack>
      </Paper>
    </Stack>
  );
}
