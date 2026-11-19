import { Paper, Stack, Text, Title } from '@mantine/core';
import type { ReactElement } from 'react';

/** Stands in for a page that a later step builds, so its route already works. */
export function PlaceholderPage({ title }: { title: string }): ReactElement {
  return (
    <Stack gap="lg">
      <Title order={1} size="h2">
        {title}
      </Title>
      <Paper withBorder p="xl">
        <Text c="dimmed">This page is not built yet.</Text>
      </Paper>
    </Stack>
  );
}
