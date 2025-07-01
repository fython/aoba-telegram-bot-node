import { CallbackQuery, InlineQueryResult, Message } from 'telegraf/types';
import { registerCommand, registerInlineQueryHandler, onBotInit } from '../registry';
import { db } from '../database';
import { sql } from 'kysely';
import { callbackQuery } from 'telegraf/filters';
import { code, fmt } from 'telegraf/format';
import { extraReplyToCurrent } from '../utils';

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
    // 检查是否已经录入过
    const existingRecord = await db
      .selectFrom('yulu_record')
      .where('content', '=', content)
      .where('author_username', '=', author)
      .selectAll()
      .executeTakeFirst();
    if (existingRecord) {
      ctx.reply(`@${author} 的语录已经存在这条内容`);
      return;
    }
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
    ctx.reply(fmt`已录入 ${code`@${author}`} 的语录`, extraReplyToCurrent(ctx));
  },
});

registerCommand({
  command: 'yulu_list',
  shortDesc: '查看我的语录列表',
  longDesc: '查看我被录入的语录列表，后面追加 `@username` 可以查看指定用户的语录列表',
  handler: async (ctx) => {
    const text = ctx.message?.text || '';
    const parts = text.split(' ').filter((p) => p.length > 0);
    let targetUsername: string;
    if (parts.length > 1 && parts[1].startsWith('@')) {
      targetUsername = parts[1].slice(1);
    } else {
      targetUsername = ctx.from.username || ctx.from.id.toString();
    }

    const page = 1;
    const { text: messageText, keyboard } = await buildYuluListPage(targetUsername, page);

    ctx.reply(messageText, {
      reply_markup: keyboard,
    });
  },
});

registerCommand({
  command: 'yulu_del',
  shortDesc: '删除指定 ID 的语录',
  longDesc: '删除指定 ID 的语录，仅限语录相关人员（被记录人 或 记录人）可以操作',
  handler: async (ctx) => {
    const text = ctx.message?.text || '';
    const parts = text.split(' ').filter((p) => p.length > 0);
    if (parts.length < 2) {
      ctx.reply('请提供要删除的语录 ID');
      return;
    }
    const recordId = parseInt(parts[1], 10);
    if (isNaN(recordId)) {
      ctx.reply('无效的语录 ID');
      return;
    }

    const record = await db
      .selectFrom('yulu_record')
      .where('id', '=', recordId)
      .selectAll()
      .executeTakeFirst();

    if (!record) {
      ctx.reply('找不到指定 ID 的语录');
      return;
    }

    const userId = ctx.from.id;
    if (record.author_user_id !== userId && record.submitter_user_id !== userId) {
      ctx.reply('你没有权限删除这条语录');
      return;
    }

    await db.deleteFrom('yulu_record').where('id', '=', recordId).execute();

    ctx.reply(`已删除语录 ID=${recordId}`);
  },
});

const PAGE_SIZE = 5;

async function buildYuluListPage(targetUsername: string, page: number) {
  const records = await db
    .selectFrom('yulu_record')
    .where('author_username', '=', targetUsername)
    .selectAll()
    .orderBy('id', 'asc')
    .offset((page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .execute();

  const totalCountResult = await db
    .selectFrom('yulu_record')
    .where('author_username', '=', targetUsername)
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst();

  const totalCount = Number(totalCountResult?.count) || 0;

  if (totalCount === 0) {
    return {
      text: `没有找到 @${targetUsername} 的语录`,
      keyboard: undefined,
    };
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const messageText = [
    `@${targetUsername} 的语录 (第 ${page}/${totalPages} 页):`,
    ...records.map((r) => `${r.id}. ${r.content}`),
  ].join('\n');

  const buttons = [];
  if (page > 1) {
    buttons.push({
      text: '上一页',
      callback_data: `yulu_list:${targetUsername}:${page - 1}`,
    });
  }
  if (page < totalPages) {
    buttons.push({
      text: '下一页',
      callback_data: `yulu_list:${targetUsername}:${page + 1}`,
    });
  }

  const keyboard = buttons.length > 0 ? { inline_keyboard: [buttons] } : undefined;

  return {
    text: messageText,
    keyboard,
  };
}

onBotInit(async (bot) => {
  bot.on(callbackQuery(), async (ctx, next) => {
    const query = ctx.callbackQuery as CallbackQuery.DataQuery | undefined;
    const matches = query?.data?.match(/^yulu_list:([^:]+):(\d+)$/);
    if (!matches) {
      return next();
    }
    const targetUsername = matches[1];
    const page = parseInt(matches[2], 10);

    if (page < 1) {
      ctx.answerCbQuery('已经是第一页了');
      return;
    }

    const { text, keyboard } = await buildYuluListPage(targetUsername, page);

    try {
      await ctx.editMessageText(text, {
        reply_markup: keyboard,
      });
    } catch (e) {
      ctx.logger.error('failed to edit message text: %o', e);
    }
    ctx.answerCbQuery();
  });
});
