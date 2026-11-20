import {
  Anchor,
  Avatar,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Group,
  Paper,
  Skeleton,
  Stack,
  Table,
  Tabs,
  Text,
  Title,
  VisuallyHidden,
} from '@mantine/core';
import { formatMoney, listCountries } from '@salary-manager/shared';
import { IconAlertTriangle, IconMapOff, IconUsersGroup } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import {
  type CountryJobTitles,
  type CountryPay,
  type CountryRef,
  type PayOutlier,
  api,
} from '../api/client';
import { PageMessage } from '../components/PageMessage';
import { formatCount, initialsOf } from '../employees/format';
import { NUMERIC_CELL, PAY_STATS_HEADERS, PayStatsCells } from './PayStatsCells';
import { gapFromMedianLabel, pluralise } from './insights-format';

function supportedCountry(code: string): CountryRef | undefined {
  // Codes are exact: "in" is not India.
  return listCountries().find((country) => country.code === code);
}

function CountrySummary({ stats }: { stats: CountryPay }): ReactElement {
  const figures: [label: string, amountMinor: number][] = [
    ['Median', stats.medianMinor],
    ['Average', stats.avgMinor],
  ];

  return (
    <Group component="section" aria-label="Country summary" gap="xl">
      {figures.map(([label, amountMinor]) => (
        <Stack key={label} gap={0} align="flex-end">
          <Text size="sm" c="dimmed">
            {label}
          </Text>
          <Text aria-label={label} fz="lg" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatMoney(amountMinor, stats.currency)}
          </Text>
        </Stack>
      ))}
    </Group>
  );
}

function PayByJobTitle({ data }: { data: CountryJobTitles }): ReactElement {
  const title = `Pay by job title in ${data.country.name}`;

  return (
    <Paper withBorder>
      <Table.ScrollContainer minWidth={760}>
        <Table verticalSpacing="sm" aria-label={title}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Job title</Table.Th>
              {PAY_STATS_HEADERS.map((header) => (
                <Table.Th key={header} style={NUMERIC_CELL}>
                  {header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.jobTitles.map((row) => (
              <Table.Tr key={row.jobTitle}>
                <Table.Td fw={600}>{row.jobTitle}</Table.Td>
                <PayStatsCells stats={row} currency={data.country.currency} />
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Paper>
  );
}

function OutlierRow({
  outlier,
  currency,
}: {
  outlier: PayOutlier;
  currency: string;
}): ReactElement {
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar color="indigo" radius="xl" size="md" aria-hidden>
            {initialsOf(outlier.fullName)}
          </Avatar>
          <Text fw={600}>{outlier.fullName}</Text>
        </Group>
      </Table.Td>
      <Table.Td>{outlier.jobTitle}</Table.Td>
      <Table.Td style={NUMERIC_CELL}>{formatMoney(outlier.salaryMinor, currency)}</Table.Td>
      <Table.Td style={NUMERIC_CELL}>{formatMoney(outlier.roleMedianMinor, currency)}</Table.Td>
      <Table.Td>
        <Badge variant="light" color={outlier.direction === 'above' ? 'orange' : 'blue'}>
          {gapFromMedianLabel(outlier.differencePct)}
        </Badge>
      </Table.Td>
      <Table.Td style={NUMERIC_CELL}>
        <Anchor component={Link} to={`/employees/${outlier.employeeId}`} size="sm">
          View profile
        </Anchor>
      </Table.Td>
    </Table.Tr>
  );
}

function Outliers({ data }: { data: CountryJobTitles }): ReactElement {
  const { country, outliers } = data;

  return (
    <Paper withBorder>
      <Text size="sm" c="dimmed" p="md">
        {`Paid more than 25% above or below the median for their job title in ${country.name}.`}
      </Text>
      {outliers.length === 0 ? (
        <Text p="md" pt={0}>
          {`No outliers in ${country.name}. Everyone is within 25% of the median for their job title.`}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table verticalSpacing="sm" aria-label={`Outliers in ${country.name}`}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Job title</Table.Th>
                <Table.Th style={NUMERIC_CELL}>Annual salary</Table.Th>
                <Table.Th style={NUMERIC_CELL}>Role median</Table.Th>
                <Table.Th>vs median</Table.Th>
                <Table.Th aria-hidden />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {outliers.map((outlier) => (
                <OutlierRow
                  key={outlier.employeeId}
                  outlier={outlier}
                  currency={country.currency}
                />
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Paper>
  );
}

const JOB_TITLES_TAB = 'job-titles';
const OUTLIERS_TAB = 'outliers';
const TAB_PARAM = 'tab';

/**
 * The two tables as tabs, so the outliers are one click away instead of below a long table.
 * The selected tab lives in the URL: a link can open the outliers, and Back returns to the
 * previous tab. Both tabs show the one response already loaded.
 */
function PayTabs({ data }: { data: CountryJobTitles }): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  // Anything other than the outliers tab, including no value, is the default tab.
  const selected = searchParams.get(TAB_PARAM) === OUTLIERS_TAB ? OUTLIERS_TAB : JOB_TITLES_TAB;

  const select = (tab: string | null): void => {
    if (tab === null || tab === selected) {
      return;
    }
    // A new history entry (not a replace), which is what lets Back return to the last tab.
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (tab === OUTLIERS_TAB) {
        next.set(TAB_PARAM, OUTLIERS_TAB);
      } else {
        next.delete(TAB_PARAM);
      }
      return next;
    });
  };

  return (
    // Only the selected tab's table is rendered: the other can be 38 rows or 1,400.
    <Tabs value={selected} onChange={select} keepMounted={false}>
      <Tabs.List aria-label={`Pay in ${data.country.name}`}>
        <Tabs.Tab value={JOB_TITLES_TAB}>
          {`Pay by job title (${formatCount(data.jobTitles.length)})`}
        </Tabs.Tab>
        <Tabs.Tab
          value={OUTLIERS_TAB}
        >{`Outliers (${formatCount(data.outliers.length)})`}</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value={JOB_TITLES_TAB} pt="md">
        <PayByJobTitle data={data} />
      </Tabs.Panel>
      <Tabs.Panel value={OUTLIERS_TAB} pt="md">
        <Outliers data={data} />
      </Tabs.Panel>
    </Tabs>
  );
}

function LoadingSkeleton(): ReactElement {
  return (
    <Stack gap="lg">
      <VisuallyHidden>Loading country insights</VisuallyHidden>
      <Skeleton height={260} radius="md" />
      <Skeleton height={220} radius="md" />
    </Stack>
  );
}

export function CountryInsightsPage(): ReactElement {
  const { countryCode = '' } = useParams();
  const country = supportedCountry(countryCode);

  const countries = useQuery({
    queryKey: ['insights', 'countries'],
    queryFn: ({ signal }) => api.getInsightsCountries(signal),
    enabled: country !== undefined,
  });
  const jobTitles = useQuery({
    queryKey: ['insights', 'countries', countryCode, 'job-titles'],
    queryFn: ({ signal }) => api.getCountryJobTitles(countryCode, signal),
    enabled: country !== undefined,
  });

  if (!country) {
    return (
      <PageMessage
        icon={<IconMapOff size={28} aria-hidden />}
        color="gray"
        title="Country not found"
      >
        <Text c="dimmed">There is no supported country with this code.</Text>
        <Button component={Link} to="/insights" variant="light">
          Back to Insights
        </Button>
      </PageMessage>
    );
  }

  const failed = countries.error ?? jobTitles.error;
  const isLoaded = countries.data !== undefined && jobTitles.data !== undefined;
  // A supported country nobody works in is simply absent from the country figures.
  const stats = countries.data?.find((candidate) => candidate.code === country.code);

  return (
    <Stack gap="lg">
      <Box component="nav" aria-label="Breadcrumb">
        <Breadcrumbs>
          <Anchor component={Link} to="/insights">
            Insights
          </Anchor>
          <Text>{country.name}</Text>
        </Breadcrumbs>
      </Box>

      <Group justify="space-between" align="flex-end">
        <Stack gap={4}>
          <Title order={1} size="h2">
            {country.name}
          </Title>
          {isLoaded && !failed && (
            <Text c="dimmed">
              {`${pluralise(stats?.headcount ?? 0, 'employee', 'employees')} · all amounts in ${country.currency}`}
            </Text>
          )}
        </Stack>
        {isLoaded && !failed && stats && <CountrySummary stats={stats} />}
      </Group>

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
              void countries.refetch();
              void jobTitles.refetch();
            }}
          >
            Retry
          </Button>
        </PageMessage>
      ) : jobTitles.data === undefined || countries.data === undefined ? (
        <LoadingSkeleton />
      ) : stats === undefined ? (
        <PageMessage
          icon={<IconUsersGroup size={28} aria-hidden />}
          color="gray"
          title={`No employees in ${country.name} yet.`}
        >
          <Text c="dimmed">Pay figures appear here once someone is added in this country.</Text>
        </PageMessage>
      ) : (
        <PayTabs data={jobTitles.data} />
      )}
    </Stack>
  );
}
