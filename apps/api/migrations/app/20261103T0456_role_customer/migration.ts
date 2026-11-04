#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/4bdfe0358c09c5608154925d70b91d7659066abd228903ff69eb74d453be2128/contract';
import startContract from '../../snapshots/4bdfe0358c09c5608154925d70b91d7659066abd228903ff69eb74d453be2128/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/6f27640e70389006667532c04cec01ff3a48959155f7031caca8fb196e6c6fee/contract';
import endContract from '../../snapshots/6f27640e70389006667532c04cec01ff3a48959155f7031caca8fb196e6c6fee/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.setDefault({
        schema: 'public',
        table: 'users',
        column: col('role', 'text', {
          default: lit('customer'),
          codecRef: { codecId: 'pg/text@1' },
        }),
        operationClass: 'widening',
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
