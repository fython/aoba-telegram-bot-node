import { Kysely } from 'kysely';

import { logger } from '../../logger';
import { AobaDatabase } from '../models';

export async function up(db: Kysely<AobaDatabase>): Promise<void> {
  logger.info('executing migration: 20250706_repeat_sticker.ts');

  // 添加新字段到 repeat_message 表
  await db.schema
    .alterTable('repeat_message')
    .addColumn('message_type', 'varchar(10)', (col) => col.notNull().defaultTo('text'))
    .addColumn('sticker_file_id', 'varchar(255)')
    .addColumn('sticker_file_unique_id', 'varchar(255)')
    .execute();

  // 修改 message_text 字段允许 NULL（对于 sticker 消息）
  await db.schema
    .alterTable('repeat_message')
    .alterColumn('message_text', (col) => col.dropNotNull())
    .execute();

  // 添加新字段到 repeat_cooldown 表
  await db.schema
    .alterTable('repeat_cooldown')
    .addColumn('message_type', 'varchar(10)', (col) => col.notNull().defaultTo('text'))
    .addColumn('sticker_file_unique_id', 'varchar(255)')
    .execute();

  // 修改 message_text 字段允许 NULL（对于 sticker 消息）
  await db.schema
    .alterTable('repeat_cooldown')
    .alterColumn('message_text', (col) => col.dropNotNull())
    .execute();

  // 为 sticker 查询优化添加索引
  await db.schema
    .createIndex('repeat_message_sticker_idx')
    .on('repeat_message')
    .columns(['chat_id', 'message_type', 'sticker_file_unique_id'])
    .execute();

  await db.schema
    .createIndex('repeat_cooldown_sticker_idx')
    .on('repeat_cooldown')
    .columns(['chat_id', 'message_type', 'sticker_file_unique_id'])
    .execute();
}

export async function down(db: Kysely<AobaDatabase>): Promise<void> {
  // 删除索引
  await db.schema.dropIndex('repeat_cooldown_sticker_idx').execute();
  await db.schema.dropIndex('repeat_message_sticker_idx').execute();

  // 删除新添加的字段
  await db.schema
    .alterTable('repeat_cooldown')
    .dropColumn('sticker_file_unique_id')
    .dropColumn('message_type')
    .execute();

  await db.schema
    .alterTable('repeat_message')
    .dropColumn('sticker_file_unique_id')
    .dropColumn('sticker_file_id')
    .dropColumn('message_type')
    .execute();

  // 恢复 message_text 字段为 NOT NULL
  await db.schema
    .alterTable('repeat_cooldown')
    .alterColumn('message_text', (col) => col.setNotNull())
    .execute();

  await db.schema
    .alterTable('repeat_message')
    .alterColumn('message_text', (col) => col.setNotNull())
    .execute();
}
