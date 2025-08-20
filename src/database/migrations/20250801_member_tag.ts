import { Kysely, sql } from 'kysely';

import { AobaDatabase } from '../models';

export async function up(db: Kysely<AobaDatabase>): Promise<void> {
  await db.schema
    .createTable('member_tag')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('chat_id', 'bigint', (col) => col.notNull())
    .addColumn('user_id', 'bigint', (col) => col.notNull())
    .addColumn('tag', 'varchar(100)', (col) => col.notNull())
    .addColumn('created_at', sql`timestamp with time zone`, (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .execute();

  await db.schema
    .createIndex('member_tag_chat_tag_idx')
    .on('member_tag')
    .columns(['chat_id', 'tag'])
    .execute();

  await db.schema
    .createIndex('member_tag_chat_user_tag_idx')
    .on('member_tag')
    .columns(['chat_id', 'user_id', 'tag'])
    .execute();
}

export async function down(db: Kysely<AobaDatabase>): Promise<void> {
  await db.schema.dropTable('member_tag').execute();
}
