#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/10e8d873027979987593d52a34d690342367c2036eec90f86b90fce0d6087ac1/contract';
import startContract from '../../snapshots/10e8d873027979987593d52a34d690342367c2036eec90f86b90fce0d6087ac1/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/40f484bbb505460eb9121406018b3da597b04056792619f64e86d1d3ada3c834/contract';
import endContract from '../../snapshots/40f484bbb505460eb9121406018b3da597b04056792619f64e86d1d3ada3c834/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [this.dropColumn({ schema: 'public', table: 'addresses', column: 'phone' })];
  }
}

MigrationCLI.run(import.meta.url, M);
