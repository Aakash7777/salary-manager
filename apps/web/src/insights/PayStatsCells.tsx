import { Table } from '@mantine/core';
import { formatMoney } from '@salary-manager/shared';
import type { CSSProperties, ReactElement } from 'react';
import type { PayStats } from '../api/client';
import { formatCount } from '../employees/format';

/** Right-aligned figures whose digits line up down a column. */
export const NUMERIC_CELL: CSSProperties = {
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

export const PAY_STATS_HEADERS = ['Headcount', 'Min', 'Median', 'Average', 'Max'];

/** The five figure cells every pay table has, in the order of PAY_STATS_HEADERS. */
export function PayStatsCells({
  stats,
  currency,
}: {
  stats: PayStats;
  currency: string;
}): ReactElement {
  return (
    <>
      <Table.Td style={NUMERIC_CELL}>{formatCount(stats.headcount)}</Table.Td>
      <Table.Td style={NUMERIC_CELL}>{formatMoney(stats.minMinor, currency)}</Table.Td>
      <Table.Td style={NUMERIC_CELL} fw={600}>
        {formatMoney(stats.medianMinor, currency)}
      </Table.Td>
      <Table.Td style={NUMERIC_CELL}>{formatMoney(stats.avgMinor, currency)}</Table.Td>
      <Table.Td style={NUMERIC_CELL}>{formatMoney(stats.maxMinor, currency)}</Table.Td>
    </>
  );
}
