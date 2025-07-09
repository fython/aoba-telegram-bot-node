import { Kysely, sql } from 'kysely';

import { logger } from '../../logger';
import { AobaDatabase } from '../models';

export async function up(db: Kysely<AobaDatabase>): Promise<void> {
  logger.info('executing migration: 20250703_repeat.ts');
  // 创建复读消息记录表
  await db.schema
    .createTable('repeat_message')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('chat_id', 'bigint', (col) => col.notNull())
    .addColumn('message_text', 'text', (col) => col.notNull())
    .addColumn('message_hash', 'varchar(64)', (col) => col.notNull())
    .addColumn('user_id', 'bigint', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // 为查询优化添加索引
  await db.schema
    .createIndex('repeat_message_chat_hash_idx')
    .on('repeat_message')
    .columns(['chat_id', 'message_hash'])
    .execute();

  // 为清理过期记录添加索引
  await db.schema
    .createIndex('repeat_message_created_idx')
    .on('repeat_message')
    .column('created_at')
    .execute();

  // 防止同一用户重复记录的唯一约束
  await db.schema
    .createIndex('repeat_message_unique_user_idx')
    .on('repeat_message')
    .columns(['chat_id', 'message_hash', 'user_id'])
    .unique()
    .execute();

  // 创建复读冷却表
  await db.schema
    .createTable('repeat_cooldown')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('chat_id', 'bigint', (col) => col.notNull())
    .addColumn('message_text', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamp', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // 为查询优化添加索引
  await db.schema
    .createIndex('repeat_cooldown_chat_hash_idx')
    .on('repeat_cooldown')
    .columns(['chat_id', 'message_text'])
    .execute();

  // 为清理过期记录添加索引
  await db.schema
    .createIndex('repeat_cooldown_created_idx')
    .on('repeat_cooldown')
    .column('created_at')
    .execute();
}

export async function down(db: Kysely<AobaDatabase>): Promise<void> {
  await db.schema.dropTable('repeat_cooldown').execute();
  await db.schema.dropTable('repeat_message').execute();
}
