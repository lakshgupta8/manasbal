#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/234f16198a81fd1d570b5dda184e7a201a7d2635b8c132d6a0d1611d77f01ba7/contract';
import endContract from '../../snapshots/234f16198a81fd1d570b5dda184e7a201a7d2635b8c132d6a0d1611d77f01ba7/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/40f484bbb505460eb9121406018b3da597b04056792619f64e86d1d3ada3c834/contract';
import startContract from '../../snapshots/40f484bbb505460eb9121406018b3da597b04056792619f64e86d1d3ada3c834/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  fn,
  lit,
  primaryKey,
  sql,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'settlements',
        columns: [
          col('commission_paise', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('created_by_visitor', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('gross_paise', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('is_sample', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('payout_paise', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('period_start', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('seller_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'shipments',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            default: fn(sql`now()`),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('created_by_visitor', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('is_sample', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('status', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sub_order_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('tracking_number', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'settlements',
        constraint: 'settlements_seller_id_period_start_key',
        columns: ['seller_id', 'period_start'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'shipments',
        constraint: 'shipments_sub_order_id_key',
        columns: ['sub_order_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'shipments',
        constraint: 'shipments_tracking_number_key',
        columns: ['tracking_number'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'settlements',
        index: 'settlements_seller_id_idx_de05cd59',
        columns: ['seller_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'settlements',
        foreignKey: {
          name: 'settlements_seller_id_fkey',
          columns: ['seller_id'],
          references: { schema: 'public', table: 'sellers', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'shipments',
        foreignKey: {
          name: 'shipments_sub_order_id_fkey',
          columns: ['sub_order_id'],
          references: { schema: 'public', table: 'sub_orders', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
