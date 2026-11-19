import {
  Anchor,
  Badge,
  Button,
  Paper,
  SimpleGrid,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
  VisuallyHidden,
} from '@mantine/core';
import { IconAlertTriangle, IconChevronRight } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { type CountryPay, type InsightsSummary, api } from '../api/client';
import { PageMessage } from '../components/PageMessage';
import { formatCount } from '../employees/format';
import { NUMERIC_CELL, PAY_STATS_HEADERS, PayStatsCells } from './PayStatsCells';
import { compactUsd, pluralise } from './insights-format';

function StatCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: ReactNode;
}): ReactElement {
  return (
    <Paper component="section" aria-label={label} withBorder p="lg">
      <Stack gap={4}>
        <Text size="sm" c="dimmed" fw={500}>
          {label}
        </Text>
        <Text fz={28} fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Text>
        {children}
      </Stack>
    </Paper>
  );
}

function Note({ children }: { children: ReactNode }): ReactElement {
  return (
    <Text size="sm" c="dimmed">
      {children}
    </Text>
  );
}

function SummaryCards({
  summary,
  countries,
}: {
  summary: InsightsSummary;
  countries: CountryPay[];
}): ReactElement {
  const currencyCount = new Set(countries.map((country) => country.currency)).size;

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
      <StatCard label="Total headcount" value={formatCount(summary.headcount)}>
        <Note>employees</Note>
      </StatCard>
      <StatCard label="Countries" value={formatCount(summary.countryCount)}>
        <Note>{pluralise(currencyCount, 'currency', 'currencies')}</Note>
      </StatCard>
      <StatCard label="Departments" value={formatCount(summary.departmentCount)}>
        <Note>{pluralise(summary.jobTitleCount, 'job title', 'job titles')}</Note>
      </StatCard>
      <StatCard label="Total annual payroll" value={`≈ ${compactUsd(summary.payrollUsdMinor)}`}>
        <Note>Converted with fixed rates, indicative only</Note>
        <Note>{`FX table ${summary.fxTableVersion}`}</Note>
      </StatCard>
    </SimpleGrid>
  );
}

function CountryRow({ country }: { country: CountryPay }): ReactElement {
  const navigate = useNavigate();
  const drillDownPath = `/insights/${country.code}`;

  return (
    <Table.Tr
      style={{ cursor: 'pointer' }}
      onClick={() => {
        void navigate(drillDownPath);
      }}
    >
      <Table.Td>
        <Anchor
          component={Link}
          to={drillDownPath}
          fw={600}
          c="dark"
          // The row itself also navigates; without this the click would do so twice.
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {country.name}
        </Anchor>
      </Table.Td>
      <Table.Td>
        <Badge variant="light" color="gray">
          {country.currency}
        </Badge>
      </Table.Td>
      <PayStatsCells stats={country} currency={country.currency} />
      <Table.Td style={NUMERIC_CELL}>
        <IconChevronRight size={16} aria-hidden />
      </Table.Td>
    </Table.Tr>
  );
}

function PayByCountry({ countries }: { countries: CountryPay[] }): ReactElement {
  return (
    <Paper withBorder>
      <Text fw={600} p="md">
        Pay by country
      </Text>
      <Table.ScrollContainer minWidth={860}>
        <Table verticalSpacing="sm" highlightOnHover aria-label="Pay by country">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Country</Table.Th>
              <Table.Th>Currency</Table.Th>
              {PAY_STATS_HEADERS.map((header) => (
                <Table.Th key={header} style={NUMERIC_CELL}>
                  {header}
                </Table.Th>
              ))}
              <Table.Th aria-hidden />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {countries.map((country) => (
              <CountryRow key={country.code} country={country} />
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Text size="sm" c="dimmed" p="md">
        Rows are in different currencies and are not directly comparable. Only the payroll total
        above is converted.
      </Text>
    </Paper>
  );
}

function LoadingSkeleton(): ReactElement {
  return (
    <Stack gap="lg">
      <VisuallyHidden>Loading insights</VisuallyHidden>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="lg">
        {[1, 2, 3, 4].map((card) => (
          <Skeleton key={card} height={132} radius="md" />
        ))}
      </SimpleGrid>
      <Skeleton height={280} radius="md" />
    </Stack>
  );
}

export function InsightsPage(): ReactElement {
  const summary = useQuery({
    queryKey: ['insights', 'summary'],
    queryFn: ({ signal }) => api.getInsightsSummary(signal),
  });
  const countries = useQuery({
    queryKey: ['insights', 'countries'],
    queryFn: ({ signal }) => api.getInsightsCountries(signal),
  });
  const failed = summary.error ?? countries.error;

  return (
    <Stack gap="lg">
      <Stack gap={4}>
        <Title order={1} size="h2">
          Insights
        </Title>
        <Text c="dimmed">How ACME pays people, by country and role.</Text>
      </Stack>

      {failed ? (
        <PageMessage
          icon={<IconAlertTriangle size={28} aria-hidden />}
          color="red"
          title="Could not load insights"
        >
          <Text c="dimmed">{failed.message}</Text>
          <Button
            variant="light"
            onClick={() => {
              void summary.refetch();
              void countries.refetch();
            }}
          >
            Retry
          </Button>
        </PageMessage>
      ) : summary.data && countries.data ? (
        <>
          <SummaryCards summary={summary.data} countries={countries.data} />
          <PayByCountry countries={countries.data} />
        </>
      ) : (
        <LoadingSkeleton />
      )}
    </Stack>
  );
}
