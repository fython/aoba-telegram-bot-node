import { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

export interface AobaDatabase {
  yulu_record: YuluRecordTable;
  repeat_message: RepeatMessageTable;
  repeat_cooldown: RepeatCooldownTable;
  member_tag: MemberTagTable;
  ai_chat_messages: AiChatMessagesTable;
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

export interface RepeatMessageTable {
  id: Generated<number>;
  chat_id: number;
  message_text: string | null;
  message_hash: string;
  user_id: number;
  message_type: 'text' | 'sticker';
  sticker_file_id: string | null;
  sticker_file_unique_id: string | null;
  created_at: Generated<Date>;
}

export interface RepeatCooldownTable {
  id: Generated<number>;
  chat_id: number;
  message_text: string | null;
  message_type: 'text' | 'sticker';
  sticker_file_unique_id: string | null;
  created_at: Generated<Date>;
}

export interface MemberTagTable {
  id: Generated<number>;
  chat_id: number;
  user_id: number;
  tag: string;
  created_at: Generated<Date>;
}

export interface AiChatMessagesTable {
  id: Generated<number>;
  chat_id: number;
  message_id: number;
  from_id: number;
  role: 'user' | 'assistant';
  text: string;
  reply_to_message_id: number | null;
  created_at: ColumnType<Date, string | undefined, string | undefined>;
}

export type YuluRecord = Selectable<YuluRecordTable>;
export type NewYuluRecord = Insertable<YuluRecordTable>;
export type RepeatMessage = Selectable<RepeatMessageTable>;
export type NewRepeatMessage = Insertable<RepeatMessageTable>;
export type RepeatCooldown = Selectable<RepeatCooldownTable>;
export type NewRepeatCooldown = Insertable<RepeatCooldownTable>;
export type MemberTag = Selectable<MemberTagTable>;
export type NewMemberTag = Insertable<MemberTagTable>;
export type AiChatMessage = Selectable<AiChatMessagesTable>;
export type NewAiChatMessage = Insertable<AiChatMessagesTable>;
export type AiChatMessageUpdate = Updateable<AiChatMessagesTable>;
