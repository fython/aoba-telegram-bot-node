import { PostgresDialect, Kysely } from 'kysely';
import { Pool } from 'pg';
import { AobaDatabase } from './models';

export const pg = new Pool({
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
});

const dialect = new PostgresDialect({ pool: pg });

export const db = new Kysely<AobaDatabase>({ dialect });
