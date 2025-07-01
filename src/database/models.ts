import { Generated, Insertable, Selectable } from 'kysely';

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
