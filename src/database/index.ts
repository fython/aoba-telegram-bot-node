import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  FileMigrationProvider,
  Generated,
  Insertable,
  Kysely,
  Migrator,
  PostgresDialect,
  Selectable,
} from 'kysely';

export const pg = new Pool({
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

const dialect = new PostgresDialect({ pool: pg });

export const db = new Kysely<AobaDatabase>({ dialect });

export const migrator = new Migrator({
  db,
  provider: new FileMigrationProvider({
    fs,
    path,
    migrationFolder: path.join(__dirname, 'migrations'),
  }),
  allowUnorderedMigrations: true,
});

export interface AobaDatabase {
  yulu_record: YuluRecordTable;
}

export interface YuluRecordTable {
  id: Generated<number>;
  content: string;
  created_at: Generated<Date>;
  author_username: string;
  author_user_id: number;
  submitter_username: string;
  submitter_user_id: number;
}

export type YuluRecord = Selectable<YuluRecordTable>;
export type NewYuluRecord = Insertable<YuluRecordTable>;
