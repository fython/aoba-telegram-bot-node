import { formatUser } from '../formatter/user';
import { registerCommand } from '../registry';

registerCommand({
  command: 'choose',
  shortDesc: '随机选择文本选项',
  longDesc: '使用 /choose <选项1> <选项2> ... <选项N> 命令让机器人随机选择一个选项。',
  handler: async (ctx) => {
    if (ctx.args.length < 2) {
      await ctx.reply('请提供至少两个选项。用法: /choose <选项1> <选项2> ... <选项N>');
      return;
    }

    const options = ctx.args;
    const randomIndex = Math.floor(Math.random() * options.length);
    const selectedOption = options[randomIndex];

    ctx.logger.info(
      'user:%s used choose command with options: %s, selected: %s',
      formatUser(ctx.from),
      options.join(', '),
      selectedOption
    );

    await ctx.reply(`选择了 ${selectedOption}`, {
      reply_parameters: {
        message_id: ctx.message.message_id,
      },
    });
  },
});
