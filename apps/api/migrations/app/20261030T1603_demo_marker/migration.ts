#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/234f16198a81fd1d570b5dda184e7a201a7d2635b8c132d6a0d1611d77f01ba7/contract';
import startContract from '../../snapshots/234f16198a81fd1d570b5dda184e7a201a7d2635b8c132d6a0d1611d77f01ba7/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/560de3260c04c1aa6afc23a1bf145367f6b9ece136eeaee420628ffb939df313/contract';
import endContract from '../../snapshots/560de3260c04c1aa6afc23a1bf145367f6b9ece136eeaee420628ffb939df313/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: '_demo_marker',
        columns: [
          col('created_at', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'uuid', { notNull: true, codecRef: { codecId: 'pg/uuid@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'coupons',
        column: col('is_sample', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'coupons',
        column: col('max_uses', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
