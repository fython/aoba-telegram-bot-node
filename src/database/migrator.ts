import * as fs from 'fs/promises';
import { FileMigrationProvider, Migrator } from 'kysely';
import * as path from 'path';

import { db } from './postgres';

export const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, 'migrations'),
  }),
  allowUnorderedMigrations: true,
});
