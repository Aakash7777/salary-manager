import { Button, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconAlertTriangle, IconUsersGroup } from '@tabler/icons-react';
import type { ReactElement } from 'react';

export function EmptyState({ onClearFilters }: { onClearFilters: () => void }): ReactElement {
  return (
    <Stack component="section" align="center" gap="sm" py={64}>
      <ThemeIcon variant="light" color="gray" size={56} radius="xl">
        <IconUsersGroup size={28} aria-hidden />
      </ThemeIcon>
      <Text fw={600} size="lg">
        No employees match your filters
      </Text>
      <Text c="dimmed">Try a different search, or remove a filter.</Text>
      <Button variant="light" onClick={onClearFilters}>
        Clear filters
      </Button>
    </Stack>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}): ReactElement {
  return (
    <Stack component="section" align="center" gap="sm" py={64} role="alert">
      <ThemeIcon variant="light" color="red" size={56} radius="xl">
        <IconAlertTriangle size={28} aria-hidden />
      </ThemeIcon>
      <Text fw={600} size="lg">
        Could not load employees
      </Text>
      <Text c="dimmed">{message}</Text>
      <Button variant="light" onClick={onRetry}>
        Retry
      </Button>
    </Stack>
  );
}
