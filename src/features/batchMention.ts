import { message } from 'telegraf/filters';
import { fmt } from 'telegraf/format';
import { Message, Update } from 'telegraf/types';

import { NarrowedAobaContext } from '../context';
import { db } from '../database';
import { NewMemberTag } from '../database/models';
import { onBotInit, registerCommand } from '../registry';
import { escapeMD } from '../utils/markdown';

type BatchContext = NarrowedAobaContext<Update.MessageUpdate<Message.TextMessage>>;

const TAG_REGEX = /@([\u4e00-\u9fff][\u4e00-\u9fff\w\d]*)/g; // 汉字开头，后面允许英文数字下划线

function extractTags(text: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = TAG_REGEX.exec(text))) {
    set.add(m[1]);
  }
  return Array.from(set);
}

// register commands using project's registerCommand pattern
registerCommand({
  command: 'member_tag_add',
  shortDesc: '为我或指定成员在当前群聊中添加标签',
  longDesc: '使用 /member_tag_add <标签> (reply to user to add for them)',
  handler: async (ctx) => {
    ctx.logger = ctx.logger.child({ feature: 'batchMention' });
    const parts = ctx.args;
    if (!parts || parts.length < 1) {
      await ctx.reply('用法: /member_tag_add <标签> [reply to user]');
      return;
    }
    const tag = parts[0];
    ctx.logger.info('tag: %s', tag);
    if (!/^([\u4e00-\u9fff][\u4e00-\u9fff\w\d]*)$/.test(tag)) {
      await ctx.reply('标签格式错误：必须以汉字开头');
      return;
    }

    let targetId = ctx.from.id;
    const replyUser = ctx.message.reply_to_message?.from;
    if (replyUser) {
      targetId = replyUser.id;
    }

    const exists = await db
      .selectFrom('member_tag')
      .select('id')
      .where('chat_id', '=', ctx.chat.id)
      .where('user_id', '=', targetId)
      .where('tag', '=', tag)
      .executeTakeFirst();

    if (exists) {
      await ctx.reply('该标签已存在，不能重复添加');
      return;
    }

    const newTag: NewMemberTag = {
      chat_id: ctx.chat.id,
      user_id: targetId,
      tag,
    };

    await db.insertInto('member_tag').values(newTag).execute();
    await ctx.reply('标签已添加', { reply_parameters: { message_id: ctx.message.message_id } });
  },
});

registerCommand({
  command: 'member_tag_del',
  shortDesc: '删除我或指定成员在当前群聊中的标签',
  longDesc: '使用 /member_tag_del <标签> (reply to user to delete for them)',
  handler: async (ctx) => {
    ctx.logger = ctx.logger.child({ feature: 'batchMention' });
    const parts = ctx.args;
    if (!parts || parts.length < 1) {
      await ctx.reply('用法: /member_tag_del <标签> [reply to user]');
      return;
    }
    const tag = parts[0];
    let targetId = ctx.from.id;
    const replyUser = ctx.message.reply_to_message?.from;
    if (replyUser) targetId = replyUser.id;

    await db
      .deleteFrom('member_tag')
      .where('chat_id', '=', ctx.chat.id)
      .where('user_id', '=', targetId)
      .where('tag', '=', tag)
      .execute();

    await ctx.reply('标签已删除', { reply_parameters: { message_id: ctx.message.message_id } });
  },
});

registerCommand({
  command: 'member_tag_list',
  shortDesc: '列出我或指定成员在当前群聊中的标签',
  longDesc: '使用 /member_tag_list (reply to user to list theirs)',
  handler: async (ctx) => {
    ctx.logger = ctx.logger.child({ feature: 'batchMention' });
    let targetId = ctx.from.id;
    const replyUser = ctx.message.reply_to_message?.from;
    if (replyUser) targetId = replyUser.id;

    const rows = await db
      .selectFrom('member_tag')
      .select(['tag'])
      .where('chat_id', '=', ctx.chat.id)
      .where('user_id', '=', targetId)
      .execute();

    if (!rows || rows.length === 0) {
      await ctx.reply(
        `当前群聊下用户 ${targetId} 没有任何标签，可以使用 /member_tag_add 来增加标签`
      );
      return;
    }

    const tags = rows.map((r) => r.tag).join(', ');
    await ctx.reply(fmt`标签列表: ${tags}`);
  },
});

async function handleMentionMessages(ctx: BatchContext, next: () => Promise<void>) {
  ctx.logger = ctx.logger.child({ feature: 'batchMention' });
  if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') return next();
  const text = ctx.text;
  if (!text) return next();

  const tags = extractTags(text);
  if (tags.length === 0) return next();

  // 查询拥有这些标签的用户
  const rows = await db
    .selectFrom('member_tag')
    .select(['user_id', 'tag'])
    .where('chat_id', '=', ctx.chat.id)
    .where('tag', 'in', tags)
    .execute();

  if (!rows || rows.length === 0) return next();

  // 按用户去重
  const usersMap = new Map<number, Set<string>>();
  for (const r of rows) {
    if (!usersMap.has(r.user_id)) usersMap.set(r.user_id, new Set());
    usersMap.get(r.user_id)!.add(r.tag);
  }

  const userIds = Array.from(usersMap.keys());
  // 构造 mention 文本
  const mentionPromises = userIds.map(async (id) => {
    try {
      const member = await ctx.telegram.getChatMember(ctx.chat.id, id);
      ctx.logger.info('Mentioning user %d: %o', id, member);
      const user = member.user;
      if (user.username && user.username.length > 0) {
        return escapeMD(`@${user.username}`);
      }
      const displayName = `${user.first_name}${user.last_name ? ` ${user.last_name}` : ''}`;
      return `[${escapeMD(displayName)}](tg://user?id=${id})`;
    } catch (error) {
      ctx.logger.warn(
        { err: error, userId: id },
        'Failed to get chat member, falling back to user ID'
      );
      return `[${id}](tg://user?id=${id})`;
    }
  });

  const settledMentions = await Promise.allSettled(mentionPromises);
  const mentions = settledMentions
    .filter((result): result is PromiseFulfilledResult<string> => result.status === 'fulfilled')
    .map((result) => result.value)
    .join(' ');
  ctx.logger.info('Mentions: %s', mentions);

  try {
    await ctx.replyWithMarkdownV2(mentions, {
      reply_parameters: {
        message_id: ctx.message.message_id,
      },
    });
  } catch (err) {
    // fallback to plain text
    ctx.logger.error({ err }, 'reply fail');
    const plain = userIds.map((id) => `@${id}`).join(' ');
    await ctx.reply(plain, { reply_parameters: { message_id: ctx.message.message_id } });
  }

  return next();
}

export const init = () =>
  onBotInit(async (bot) => {
    bot.on(message('text'), (ctx, next) =>
      handleMentionMessages(ctx as unknown as BatchContext, next)
    );
  });

if (process.env.AOBA_FEATURE_BATCH_MENTION_DISABLED !== '1') {
  init();
}
