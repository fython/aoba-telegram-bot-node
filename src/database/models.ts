import { Generated, Insertable, Selectable } from 'kysely';

export interface AobaDatabase {
  yulu_record: YuluRecordTable;
  repeat_message: RepeatMessageTable;
  repeat_cooldown: RepeatCooldownTable;
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
  message_text: string;
  message_hash: string;
  user_id: number;
  created_at: Generated<Date>;
}

export interface RepeatCooldownTable {
  id: Generated<number>;
  chat_id: number;
  message_text: string;
  created_at: Generated<Date>;
}

export type YuluRecord = Selectable<YuluRecordTable>;
export type NewYuluRecord = Insertable<YuluRecordTable>;
export type RepeatMessage = Selectable<RepeatMessageTable>;
export type NewRepeatMessage = Insertable<RepeatMessageTable>;
export type RepeatCooldown = Selectable<RepeatCooldownTable>;
export type NewRepeatCooldown = Insertable<RepeatCooldownTable>;
