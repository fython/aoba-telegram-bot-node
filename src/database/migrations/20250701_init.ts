import { Kysely, sql } from 'kysely';
import { AobaDatabase } from '..';

export async function up(db: Kysely<AobaDatabase>): Promise<void> {
  await db.schema
    .createTable('yulu_record')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('author_username', 'varchar(64)', (col) => col.notNull())
    .addColumn('author_user_id', 'bigint', (col) => col.notNull())
    .addColumn('submitter_username', 'varchar(64)', (col) => col.notNull())
    .addColumn('submitter_user_id', 'bigint', (col) => col.notNull())
    .execute();
  await db.schema
    .createIndex('idx_author_user_id')
    .on('yulu_record')
    .column('author_user_id')
    .execute();
  await db.schema
    .createIndex('idx_author_username')
    .on('yulu_record')
    .column('author_username')
    .execute();
}

export async function down(db: Kysely<AobaDatabase>): Promise<void> {
  await db.schema.dropTable('yulu_record').execute();
}
