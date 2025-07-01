import { FileMigrationProvider, Migrator } from 'kysely';
import { db } from './postgres';
import * as fs from 'fs/promises';
import * as path from 'path';

export const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, 'migrations'),
  }),
  allowUnorderedMigrations: true,
});
