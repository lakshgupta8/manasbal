#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/388d6cebae6daa78831f17e3c0880e1ae9e8ba02e1de6c4e217520db597338e9/contract';
import startContract from '../../snapshots/388d6cebae6daa78831f17e3c0880e1ae9e8ba02e1de6c4e217520db597338e9/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/93bace9667797ea9145e3561f2c349646b7512422d4db8245d6776616f9a25c6/contract';
import endContract from '../../snapshots/93bace9667797ea9145e3561f2c349646b7512422d4db8245d6776616f9a25c6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'cart_items',
        columns: [
          col('cart_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('quantity', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('variant_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'carts',
        columns: [
          col('created_by_visitor', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('user_id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'cart_items',
        constraint: 'cart_items_cart_id_variant_id_key',
        columns: ['cart_id', 'variant_id'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'carts',
        constraint: 'carts_user_id_key',
        columns: ['user_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cart_items',
        index: 'cart_items_cart_id_idx_0b3cd05c',
        columns: ['cart_id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'cart_items',
        index: 'cart_items_variant_id_idx_4a7fac73',
        columns: ['variant_id'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cart_items',
        foreignKey: {
          name: 'cart_items_cart_id_fkey',
          columns: ['cart_id'],
          references: { schema: 'public', table: 'carts', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'cart_items',
        foreignKey: {
          name: 'cart_items_variant_id_fkey',
          columns: ['variant_id'],
          references: { schema: 'public', table: 'variants', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'carts',
        foreignKey: {
          name: 'carts_user_id_fkey',
          columns: ['user_id'],
          references: { schema: 'public', table: 'users', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
