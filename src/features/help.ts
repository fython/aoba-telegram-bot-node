import { getBotCommands, onBotInit } from '../registry';
import { getVersionMessageForBot } from '../utils/version';

onBotInit(async (bot) => {
  bot.command('help', async (ctx) => {
    ctx.logger.info('requested help command');
    const cmds = getBotCommands();

    if (ctx.args.length > 0) {
      const commandName = ctx.args[0].toLowerCase();
      const cmd = cmds.find((c) => c.command === commandName);
      if (cmd) {
        let response = `/${cmd.command} - ${cmd.shortDesc}`;
        if (cmd.longDesc) {
          response += `\n\n${cmd.longDesc}`;
        }
        await ctx.reply(response);
      } else {
        await ctx.reply(`未找到命令 /${commandName} 。请使用 /help 查看所有可用命令。`);
      }
      return;
    }

    let s = 'Aoba Bot 支持的命令:\n\n';

    for (const cmd of cmds) {
      s += `/${cmd.command} - ${cmd.shortDesc}\n`;
    }

    s += '\n了解命令更多详情可以使用 /help <command_name> 语法查询';
    s += `\n\n${getVersionMessageForBot()}`;

    await ctx.reply(s);
  });
});
