import {
  Alert,
  Badge,
  Button,
  Group,
  NumberInput,
  Paper,
  Skeleton,
  Slider,
  Stack,
  Table,
  Text,
  Title,
  VisuallyHidden,
} from '@mantine/core';
import { MAX_RAISE_PCT, formatMoney } from '@salary-manager/shared';
import { IconAlertTriangle, IconInfoCircle, IconUsersGroup } from '@tabler/icons-react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { type ReactElement, useEffect, useState } from 'react';
import { type RaiseSimulation, api } from '../api/client';
import { PageMessage } from '../components/PageMessage';
import { DirectoryFilters } from '../employees/DirectoryFilters';
import { formatCount } from '../employees/format';
import { toSimulationRequest, usdRoundedToWholeDollars } from './simulator-query';
import { useSimulatorQuery } from './useSimulatorQuery';

const META_STALE_MS = 5 * 60 * 1000;
const TYPING_PAUSE_MS = 300;
const NUMERIC_CELL = { textAlign: 'right', fontVariantNumeric: 'tabular-nums' } as const;
const SLIDER_MARKS = [0, 10, 20, 30, 40, 50].map((value) => ({ value, label: `${value}%` }));

interface RaiseControlProps {
  pct: number;
  onChange: (pct: number) => void;
}

function RaiseControl({ pct, onChange }: RaiseControlProps): ReactElement {
  // The controls show what is being typed or dragged; the URL follows once that settles.
  const [draft, setDraft] = useState<number | string>(pct);
  const [pctInUrl, setPctInUrl] = useState(pct);
  if (pct !== pctInUrl) {
    // The URL changed from outside the controls (Back was pressed, or a link was opened).
    setPctInUrl(pct);
    setDraft(pct);
  }

  useEffect(() => {
    // An empty box is not a percentage, so nothing is asked until there is one.
    if (typeof draft !== 'number' || draft === pct) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      onChange(draft);
    }, TYPING_PAUSE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [draft, pct, onChange]);

  return (
    <Paper withBorder p="md">
      <Group align="flex-start" gap="xl">
        <NumberInput
          label="Raise"
          suffix="%"
          value={draft}
          onChange={setDraft}
          min={0}
          max={MAX_RAISE_PCT}
          step={0.5}
          decimalScale={1}
          // Strict, so a value the API would reject can never be in the box.
          clampBehavior="strict"
          allowNegative={false}
          w={140}
        />
        <Slider
          thumbLabel="Raise percentage"
          value={typeof draft === 'number' ? draft : pct}
          onChange={setDraft}
          // Asking once the thumb is released, not for every step of a drag.
          onChangeEnd={onChange}
          min={0}
          max={MAX_RAISE_PCT}
          step={0.1}
          marks={SLIDER_MARKS}
          label={(value) => `${value}%`}
          flex={1}
          miw={260}
          mt={28}
          mb="lg"
        />
      </Group>
    </Paper>
  );
}

function Results({ simulation }: { simulation: RaiseSimulation }): ReactElement {
  const matchLine =
    simulation.headcount === 1
      ? '1 employee matches'
      : `${formatCount(simulation.headcount)} employees match`;

  return (
    <Stack gap="sm">
      <Text fw={500}>{matchLine}</Text>
      <Paper withBorder>
        <Table.ScrollContainer minWidth={720}>
          <Table verticalSpacing="sm" aria-label="Cost of the raise by currency">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Currency</Table.Th>
                <Table.Th style={NUMERIC_CELL}>Employees</Table.Th>
                <Table.Th style={NUMERIC_CELL}>Current total</Table.Th>
                <Table.Th style={NUMERIC_CELL}>Increase</Table.Th>
                <Table.Th style={NUMERIC_CELL}>New total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {simulation.byCurrency.map((row) => (
                <Table.Tr key={row.currency}>
                  <Table.Td>
                    <Badge variant="light" color="gray">
                      {row.currency}
                    </Badge>
                  </Table.Td>
                  <Table.Td style={NUMERIC_CELL}>{formatCount(row.headcount)}</Table.Td>
                  <Table.Td style={NUMERIC_CELL}>
                    {formatMoney(row.currentTotalMinor, row.currency)}
                  </Table.Td>
                  <Table.Td style={NUMERIC_CELL} fw={600}>
                    {formatMoney(row.increaseMinor, row.currency)}
                  </Table.Td>
                  <Table.Td style={NUMERIC_CELL}>
                    {formatMoney(row.newTotalMinor, row.currency)}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        {/* The rows are in different currencies, so the only total is the converted one. */}
        <Stack gap={2} p="md">
          <Text fw={600}>
            {`Total increase ≈ ${usdRoundedToWholeDollars(simulation.increaseUsdMinor)}, indicative only`}
          </Text>
          <Text size="sm" c="dimmed">
            {`Converted with fixed rates. FX table ${simulation.fxTableVersion}`}
          </Text>
        </Stack>
      </Paper>
    </Stack>
  );
}

export function SimulatorPage(): ReactElement {
  const { query, update, clearFilters } = useSimulatorQuery();
  const request = toSimulationRequest(query);

  const simulation = useQuery({
    queryKey: ['simulations', 'raise', request],
    queryFn: ({ signal }) => api.simulateRaise(request, signal),
    // The result already on screen stays there until the next one arrives.
    placeholderData: keepPreviousData,
  });
  const meta = useQuery({
    queryKey: ['meta'],
    queryFn: ({ signal }) => api.getMeta(signal),
    staleTime: META_STALE_MS,
  });

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h2">
          Raise simulator
        </Title>
        <Text c="dimmed">See what a raise would cost for any group of employees.</Text>
      </Stack>

      <Alert variant="light" color="blue" icon={<IconInfoCircle size={18} aria-hidden />}>
        This is a preview only. Nothing is saved and no salary is changed.
      </Alert>

      <DirectoryFilters query={query} meta={meta.data} onChange={update} onClear={clearFilters} />
      <RaiseControl
        pct={query.pct}
        onChange={(pct) => {
          update({ pct });
        }}
      />

      {simulation.isError ? (
        <PageMessage
          icon={<IconAlertTriangle size={28} aria-hidden />}
          color="red"
          title="Could not run the simulation"
        >
          <Text c="dimmed">{simulation.error.message}</Text>
          <Button
            variant="light"
            onClick={() => {
              void simulation.refetch();
            }}
          >
            Retry
          </Button>
        </PageMessage>
      ) : !simulation.data ? (
        <Stack gap="sm">
          <VisuallyHidden>Calculating</VisuallyHidden>
          <Skeleton height={240} radius="md" />
        </Stack>
      ) : simulation.data.headcount === 0 ? (
        <PageMessage
          icon={<IconUsersGroup size={28} aria-hidden />}
          color="gray"
          title="No employees match"
        >
          <Text c="dimmed">Change or clear the filters to see what a raise would cost.</Text>
        </PageMessage>
      ) : (
        <Results simulation={simulation.data} />
      )}
    </Stack>
  );
}
