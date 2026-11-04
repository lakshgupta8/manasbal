#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/95b4eb5fefd1121897e8da1274767e768b734ca369649ac6f82a404b0fa6f2b2/contract';
import startContract from '../../snapshots/95b4eb5fefd1121897e8da1274767e768b734ca369649ac6f82a404b0fa6f2b2/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/cb40b11c2753b51ead95c48da3d5e5e307626283d04086c216e92cc3a1c0df1d/contract';
import endContract from '../../snapshots/cb40b11c2753b51ead95c48da3d5e5e307626283d04086c216e92cc3a1c0df1d/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropNotNull({ schema: 'public', table: 'audit_logs', column: 'target_id' }),
      this.dropNotNull({ schema: 'public', table: 'audit_logs', column: 'target_type' }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
