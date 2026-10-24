#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/388d6cebae6daa78831f17e3c0880e1ae9e8ba02e1de6c4e217520db597338e9/contract';
import endContract from '../../snapshots/388d6cebae6daa78831f17e3c0880e1ae9e8ba02e1de6c4e217520db597338e9/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/ee29e4eeb53fcfb2910f3ea5f545443bf90bd884761824872dfee207ccf6f3f6/contract';
import startContract from '../../snapshots/ee29e4eeb53fcfb2910f3ea5f545443bf90bd884761824872dfee207ccf6f3f6/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, sql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'reviews',
        column: col('created_at', 'timestamptz', {
          notNull: true,
          default: fn(sql`now()`),
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'reviews',
        index: 'reviews_product_id_created_at_id_idx_986a1d4c',
        columns: ['product_id', 'created_at', 'id'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
