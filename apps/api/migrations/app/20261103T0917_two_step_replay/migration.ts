#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/95b4eb5fefd1121897e8da1274767e768b734ca369649ac6f82a404b0fa6f2b2/contract';
import endContract from '../../snapshots/95b4eb5fefd1121897e8da1274767e768b734ca369649ac6f82a404b0fa6f2b2/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/e8061134ca080bbfd247a103cf8de488426d4e45c05b21d7075eeeb8be0da118/contract';
import startContract from '../../snapshots/e8061134ca080bbfd247a103cf8de488426d4e45c05b21d7075eeeb8be0da118/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'users',
        column: col('totp_last_step', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
