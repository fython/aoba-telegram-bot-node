import { InlineQueryResult, Message } from 'telegraf/types';
import { registerCommand, registerInlineQueryHandler } from '../registry';
import { db } from '../database';
import { sql } from 'kysely';

registerInlineQueryHandler(async (ctx, next) => {
  ctx.logger = ctx.logger.child({ feature: 'yulu' });
  const query = ctx.inlineQuery?.query?.trim() || '';
  if (!query || !query.startsWith('@')) {
    return next();
  }
  ctx.logger.debug('Received inline query: %s', query);
  const key = query.slice(1).toLowerCase();
  const records = await db
    .selectFrom('yulu_record')
    .where(sql.id('author_username'), '=', key)
    .selectAll()
    .execute();
  ctx.logger.debug('key: %s records: %o', key, records);
  if (records.length === 0) {
    ctx.answerInlineQuery([], { cache_time: 0 });
    return;
  }
  const results: InlineQueryResult[] = records.map((r) => ({
    type: 'article',
    id: `yulu_${key}_${r.id}`,
    title: r.content,
    input_message_content: {
      message_text: `@${key}: ${r.content}`,
    },
  }));
  ctx.answerInlineQuery(results, {
    cache_time: 0,
  });
});

registerCommand({
  command: 'yulu',
  shortDesc: '录入语录',
  longDesc: '回复一条文本信息，并输入 /yulu 命令来录入语录。录入后可以通过 Inline Query 回放',
  handler: async (ctx) => {
    const replyMsg = ctx.message?.reply_to_message as Message.TextMessage;
    if (!replyMsg || !replyMsg.text || !replyMsg.from) {
      ctx.reply('请回复一条文本消息来录入语录');
      return;
    }
    const content = replyMsg.text.trim();
    if (content.length === 0) {
      ctx.reply('内容不能为空');
      return;
    }
    const author = replyMsg.from.username || replyMsg.from.id.toString();
    await db
      .insertInto('yulu_record')
      .values({
        content,
        author_username: author,
        author_user_id: replyMsg.from.id,
        submitter_username: ctx.from.username || ctx.from.id.toString(),
        submitter_user_id: ctx.from.id,
      })
      .execute();
    ctx.reply(`已录入 @${author} 的语录`);
  },
});
