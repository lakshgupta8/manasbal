#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/52d6c26a965f003d7e0ffb3c47c0cc016998982299bf18f68a52b8e6b082ce7a/contract';
import endContract from '../../snapshots/52d6c26a965f003d7e0ffb3c47c0cc016998982299bf18f68a52b8e6b082ce7a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8c0dadf207e3643caf38a37e807fe8382b0b346b70b046417e83d9e6e35bcd77/contract';
import startContract from '../../snapshots/8c0dadf207e3643caf38a37e807fe8382b0b346b70b046417e83d9e6e35bcd77/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'inventory',
        columns: [
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('location', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('quantity', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('reserved', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('variant_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'sellers',
        columns: [
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('is_sample', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('slug', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('pending'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('store_name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'variants',
        columns: [
          col('colour', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('price_paise', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('product_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('size', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('sku', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addRequiredColumnToEmptyTable({
        schema: 'public',
        table: 'products',
        column: 'seller_id',
        type: 'uuid',
      }),
      this.addUnique({
        schema: 'public',
        table: 'sellers',
        constraint: 'sellers_user_id_key',
        columns: ['user_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'sellers',
        constraint: 'sellers_slug_key',
        columns: ['slug'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'variants',
        constraint: 'variants_sku_key',
        columns: ['sku'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'inventory',
        index: 'inventory_variant_id_idx_4a7fac73',
        columns: ['variant_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'products',
        index: 'products_seller_id_idx_de05cd59',
        columns: ['seller_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'variants',
        index: 'variants_product_id_idx_22a2b7d2',
        columns: ['product_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'inventory',
        foreignKey: {
          name: 'inventory_variant_id_fkey',
          columns: ['variant_id'],
          references: { schema: 'public', table: 'variants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'sellers',
        foreignKey: {
          name: 'sellers_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'products',
        foreignKey: {
          name: 'products_seller_id_fkey',
          columns: ['seller_id'],
          references: { schema: 'public', table: 'sellers', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'variants',
        foreignKey: {
          name: 'variants_product_id_fkey',
          columns: ['product_id'],
          references: { schema: 'public', table: 'products', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
