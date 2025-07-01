import { registerCommand } from '../registry';
import { getVersionMessageForBot } from '../utils/version';

registerCommand({
  command: 'version',
  shortDesc: '显示机器人版本信息',
  longDesc: '显示机器人的详细版本信息，包括 Git commit 信息和构建时间',
  handler: async (ctx) => {
    ctx.logger.info('requested version command');

    let response = '🤖 **Aoba Bot 版本信息**\n\n';

    response += getVersionMessageForBot();

    await ctx.reply(response, { parse_mode: 'Markdown' });
  },
});
