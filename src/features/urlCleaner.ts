import { message } from 'telegraf/filters';
import { Message } from 'telegraf/types';

import { onBotInit, registerCommand } from '../registry';
import { extraReplyToCurrent } from '../utils';
import { isUrlSimilar } from '../utils/urlCleaner';

registerCommand({
  command: 'clean_url',
  shortDesc: '快速清理 URL 中的跟踪参数',
  longDesc:
    '快速清理 URL 中的跟踪参数，保留指定的查询参数。使用方法：/clean_url <url> 或引用一条带有链接的消息回复 /clean_url',
  handler: async (ctx) => {
    let url: string | undefined;
    if (!ctx.message.reply_to_message) {
      // 如果没有回复消息，直接从命令参数中获取 URL
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length > 0) {
        url = args.join(' ').trim();
      } else {
        await ctx.reply('请提供要清理的 URL 或引用一条带有链接的消息。', extraReplyToCurrent(ctx));
        return;
      }
    } else if ((ctx.message?.reply_to_message as Message.TextMessage)?.entities) {
      // 如果是回复消息，提取链接
      const msg = ctx.message.reply_to_message as Message.TextMessage;
      const linkEntity = msg.entities?.find(
        (entity) => entity.type === 'url' || entity.type === 'text_link'
      );
      if (linkEntity) {
        url = msg.text?.slice(linkEntity.offset, linkEntity.offset + linkEntity.length);
      }
    }
    if (!url) {
      await ctx.reply('请提供有效的 URL 或引用一条带有链接的消息。', extraReplyToCurrent(ctx));
      return;
    }

    try {
      const cleanedUrl = await ctx.urlCleaner.cleanUrl(url);
      if (isUrlSimilar(new URL(url), cleanedUrl)) {
        ctx.logger.debug('No changes made to URL: %s', url);
        await ctx.reply(`没有对 URL 进行任何更改: ${cleanedUrl.href}`, extraReplyToCurrent(ctx));
        return;
      }
      ctx.logger.info('before clean url: %s . after clean url: %s', url, cleanedUrl.href);
      await ctx.reply(`清理后的 URL: ${cleanedUrl.href}`, {
        ...extraReplyToCurrent(ctx),
        link_preview_options: {
          is_disabled: true,
        },
      });
    } catch (err) {
      ctx.logger.error({ err }, '清理 URL 时发生错误');
      await ctx.reply(`清理 URL 时发生错误: ${err}`);
    }
  },
});

onBotInit(async (bot) => {
  bot.on(message('text'), async (ctx, next) => {
    if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
      return;
    }
    const { autoCleanGroups } = ctx.config.features.urlCleaner || {};
    if (!autoCleanGroups) {
      return next();
    }
    const chatId = ctx.chat.id.toString();
    const groupConfig = autoCleanGroups.find((group) => group.chatId === chatId);
    if (!groupConfig) {
      return next();
    }
    for (const entry of ctx.entities('url', 'text_link')) {
      const url = entry.fragment;
      if (!url) {
        continue;
      }
      const urlObj = new URL(url);
      if (
        groupConfig.urlMatches.some((match) => {
          const regex = new RegExp(match, 'i');
          return regex.test(urlObj.href);
        })
      ) {
        try {
          const cleanedUrl = await ctx.urlCleaner.cleanUrl(urlObj);
          ctx.logger.info('Auto-cleaned URL: %s -> %s', url, cleanedUrl.href);
          if (isUrlSimilar(urlObj, cleanedUrl)) {
            ctx.logger.debug('No changes made to URL: %s', url);
            return next();
          }
          await ctx.reply(`自动清理后的 URL: ${cleanedUrl.href}`, extraReplyToCurrent(ctx));
        } catch (err) {
          ctx.logger.error({ err }, '自动清理 URL 时发生错误');
          await ctx.reply(`自动清理 URL 时发生错误: ${err}`);
        }
      }
    }
    return next();
  });
});
