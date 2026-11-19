import { Title } from '@mantine/core';
import { APP_NAME } from '@salary-manager/shared';
import type { ReactElement } from 'react';

export function App(): ReactElement {
  return <Title order={1}>{APP_NAME}</Title>;
}
