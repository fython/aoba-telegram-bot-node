import OpenAI from 'openai';
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionUserMessageParam,
} from 'openai/resources';
import { message } from 'telegraf/filters';
import { Message } from 'telegraf/types';

import { AiChatMessage, NewAiChatMessage } from '../database/models';
import { BotInitFn, onBotInit, registerCommand } from '../registry';
import { extraReplyToCurrent } from '../utils';

type AiMsgList = (ChatCompletionAssistantMessageParam | ChatCompletionUserMessageParam)[];

registerCommand({
  command: 'pplx',
  shortDesc: '使用 Perplexity AI 进行搜索/对话',
  longDesc: '使用 Perplexity AI 进行搜索或对话',
  handler: async (ctx) => {
    if (!ctx.config.features.aiChat?.perplexityApiKey) {
      await ctx.reply('AI 聊天功能未启用或 Perplexity API 密钥未配置');
      return;
    }
    // 如果有引用文本消息则使用引用文本消息对话，如果没有则使用命令后的所有字符对话
    const text =
      (ctx.message?.reply_to_message as Message.TextMessage)?.text ||
      ctx.message?.text?.replace(/^\/pplx\s?/, '');
    if (!text) {
      await ctx.reply('请提供要查询的内容或回复一条消息进行对话');
      return;
    }
    const api = new OpenAI({
      baseURL: 'https://api.perplexity.ai',
      apiKey: ctx.config.features.aiChat.perplexityApiKey,
    });
    try {
      ctx.logger.debug('user message: %s', text);
      const response = await api.chat.completions.create({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: text }],
        max_tokens: 1000,
      });
      const replyText = response.choices[0].message.content;
      if (!replyText) {
        ctx.reply('AI 没有返回任何内容，请稍后再试。');
        return;
      }
      const sentMessage = await ctx.reply(replyText, {
        parse_mode: 'Markdown',
        ...extraReplyToCurrent(ctx),
      });

      if (!sentMessage.from) {
        ctx.logger.error('sentMessage.from is undefined');
        return;
      }

      // 保存用户和 AI 的消息到数据库
      const userMessage: NewAiChatMessage = {
        chat_id: ctx.chat.id,
        message_id: ctx.message.message_id,
        from_id: ctx.from.id,
        role: 'user',
        text: text,
        reply_to_message_id: (ctx.message.reply_to_message as Message.TextMessage)?.message_id,
      };
      const assistantMessage: NewAiChatMessage = {
        chat_id: sentMessage.chat.id,
        message_id: sentMessage.message_id,
        from_id: sentMessage.from.id,
        role: 'assistant',
        text: replyText,
        reply_to_message_id: ctx.message.message_id,
      };
      await ctx.db.insertInto('ai_chat_messages').values([userMessage, assistantMessage]).execute();
    } catch (error) {
      ctx.logger.error({ error }, 'failed to get AI response from Perplexity');
      await ctx.reply('对不起，AI 请求失败，请稍后再试。');
    }
  },
});

export const init: BotInitFn = async (bot) => {
  bot.on(message('text'), async (ctx, next) => {
    const replyToMessage = ctx.message.reply_to_message;
    if (!replyToMessage) {
      return next();
    }

    // 检查被引用的消息是否存在于 AI 对话历史中
    const repliedMessage = await ctx.db
      .selectFrom('ai_chat_messages')
      .where('chat_id', '=', replyToMessage.chat.id)
      .where('message_id', '=', replyToMessage.message_id)
      .selectAll()
      .executeTakeFirst();

    if (!repliedMessage) {
      return next();
    }

    // 从数据库中递归获取完整的对话历史
    const messages: AiMsgList = [];
    let currentMessageId: number | null = replyToMessage.message_id;
    while (currentMessageId) {
      const msg: AiChatMessage | undefined = await ctx.db
        .selectFrom('ai_chat_messages')
        .where('chat_id', '=', replyToMessage.chat.id)
        .where('message_id', '=', currentMessageId)
        .selectAll()
        .executeTakeFirst();
      if (msg) {
        messages.unshift({ role: msg.role, content: msg.text });
        currentMessageId = msg.reply_to_message_id;
      } else {
        currentMessageId = null;
      }
    }

    // 添加当前用户消息
    messages.push({ role: 'user', content: ctx.message.text });

    ctx.logger.debug('collected messages: %o', messages);

    const api = new OpenAI({
      baseURL: 'https://api.perplexity.ai',
      apiKey: ctx.config.features.aiChat?.perplexityApiKey,
    });

    try {
      const response = await api.chat.completions.create({
        model: 'sonar-pro',
        messages,
        max_tokens: 1000,
      });
      const replyText = response.choices[0].message.content;
      if (!replyText) {
        await ctx.reply('AI 没有返回任何内容，请稍后再试。');
        return;
      }
      const sentMessage = await ctx.reply(replyText, {
        parse_mode: 'Markdown',
        ...extraReplyToCurrent(ctx),
      });

      if (!sentMessage.from) {
        ctx.logger.error('sentMessage.from is undefined');
        return;
      }

      // 保存用户和 AI 的新消息到数据库
      const userMessage: NewAiChatMessage = {
        chat_id: ctx.chat.id,
        message_id: ctx.message.message_id,
        from_id: ctx.from.id,
        role: 'user',
        text: ctx.message.text,
        reply_to_message_id: replyToMessage.message_id,
      };
      const assistantMessage: NewAiChatMessage = {
        chat_id: sentMessage.chat.id,
        message_id: sentMessage.message_id,
        from_id: sentMessage.from.id,
        role: 'assistant',
        text: replyText,
        reply_to_message_id: ctx.message.message_id,
      };
      await ctx.db.insertInto('ai_chat_messages').values([userMessage, assistantMessage]).execute();
    } catch (error) {
      ctx.logger.error({ error }, 'failed to get AI response from Perplexity');
      await ctx.reply('对不起，AI 请求失败，请稍后再试。');
    }
  });
};

if (process.env.AOBA_FEATURE_AI_CHAT_DISABLED !== '1') {
  onBotInit(init);
}
