import { Kysely, sql } from 'kysely';

import { AobaDatabase } from '../models';

export async function up(db: Kysely<AobaDatabase>): Promise<void> {
  await db.schema
    .createTable('ai_chat_messages')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('chat_id', 'bigint', (col) => col.notNull())
    .addColumn('message_id', 'bigint', (col) => col.notNull())
    .addColumn('from_id', 'bigint', (col) => col.notNull())
    .addColumn('role', 'varchar(255)', (col) => col.notNull())
    .addColumn('text', 'text', (col) => col.notNull())
    .addColumn('reply_to_message_id', 'bigint')
    .addColumn('created_at', sql`timestamp with time zone`, (col) =>
      col.defaultTo(sql`now()`).notNull()
    )
    .addUniqueConstraint('ai_chat_messages_chat_id_message_id_key', ['chat_id', 'message_id'])
    .execute();
}

export async function down(db: Kysely<AobaDatabase>): Promise<void> {
  await db.schema.dropTable('ai_chat_messages').execute();
}
