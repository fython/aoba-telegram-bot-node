import { Message } from 'telegraf/types';

import { formatUser } from '../formatter/user';
import { registerCommand } from '../registry';

registerCommand({
  command: 'replace',
  shortDesc: '替换文本中的指定内容',
  longDesc: '使用 /replace <old_text> <new_text> 命令替换文本中的指定内容。',
  handler: async (ctx) => {
    if (ctx.args.length !== 2) {
      await ctx.reply('请提供要替换的旧文本和新文本。用法: /replace <old_text> <new_text>');
      return;
    }
    const replyMessage = ctx.message.reply_to_message as Message.TextMessage;
    if (!replyMessage || typeof replyMessage.text !== 'string') {
      await ctx.reply('请回复一条包含文本的消息来进行替换。');
      return;
    }

    const fromUserName = replyMessage.from?.first_name || replyMessage.from?.id;
    const [oldText, newText] = ctx.args;

    ctx.logger.info(
      "user:%s replaced message sent by %s with oldText: '%s', newText: '%s'",
      formatUser(ctx.from),
      fromUserName,
      oldText,
      newText
    );

    let textToReplace = replyMessage.text;
    if (!textToReplace) {
      await ctx.reply('没有找到需要替换的文本。');
      return;
    }
    textToReplace = textToReplace.replace(new RegExp(oldText, 'g'), newText);
    await ctx.reply(`${fromUserName}：${textToReplace}`);
  },
});
