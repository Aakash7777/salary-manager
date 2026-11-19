import { Paper, Stack, Text, ThemeIcon } from '@mantine/core';
import type { ReactElement, ReactNode } from 'react';

interface PageMessageProps {
  icon: ReactNode;
  color: string;
  title: string;
  children: ReactNode;
}

/** A centred card that takes the place of a page's content: not found, failed, nothing yet. */
export function PageMessage({ icon, color, title, children }: PageMessageProps): ReactElement {
  return (
    <Paper withBorder>
      <Stack align="center" gap="sm" py={64}>
        <ThemeIcon variant="light" color={color} size={56} radius="xl">
          {icon}
        </ThemeIcon>
        <Text fw={600} size="lg">
          {title}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}
