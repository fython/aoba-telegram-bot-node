import { registerCommand } from '../registry';
import { extraReplyToCurrent } from '../utils';

registerCommand({
  command: 'ids',
  shortDesc: '获取用户或群组的 ID',
  longDesc:
    '使用此命令可以获取自己的 ID，以及当前聊天的 ID，若回复了某条消息，则可以获取该消息的发送者 ID。',
  handler: async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const replyToMessage = ctx.message.reply_to_message;

    let text = `你的 ID: \`${userId}\`\n当前聊天的 ID: \`${chatId}\``;
    if (replyToMessage?.from) {
      const repliedUserId = replyToMessage.from.id;
      text += `\n回复的消息发送者 ID: \`${repliedUserId}\``;
    }
    ctx.logger.info('text: %s', text);
    await ctx.reply(text, { ...extraReplyToCurrent(ctx), parse_mode: 'MarkdownV2' });
  },
});
