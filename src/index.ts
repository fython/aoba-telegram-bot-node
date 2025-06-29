import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { AobaContext } from './context';
import { initializeBot } from './registry';
import { logger } from './logger';
import { formatUser } from './formatter/user';

import './commands/help';
import './commands/replace';
import './features/userInteract';

async function main(): Promise<void> {
  const token = process.env.AOBA_BOT_TOKEN;
  if (!token) {
    throw new Error('AOBA_BOT_TOKEN is not set in the environment variables');
  }
  const bot = new Telegraf<AobaContext>(token);
  bot.context.logger = logger;
  bot.use((ctx, next) => {
    if (ctx.from) {
      ctx.userDisplay = formatUser(ctx.from);
      ctx.logger = logger.child({ user: formatUser(ctx.from) });
    }
    return next();
  });

  await initializeBot(bot);

  bot.launch({
    // 忽略历史消息
    dropPendingUpdates: true,
  });
  bot.botInfo = await bot.telegram.getMe();

  logger.info('Aoba Bot is running...');
  logger.info('Bot info: %o', bot.botInfo);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Caught an error while starting the bot');
});
