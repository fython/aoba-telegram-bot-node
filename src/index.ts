import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { AobaContext } from './context';
import { initializeBot } from './registry';
import { logger } from './logger';
import { formatUser } from './formatter/user';
import { migrator } from './database';

import './features/choose';
import './features/help';
import './features/repeat';
import './features/replace';
import './features/userInteract';
import './features/version';
import './features/yulu';
import './features/ids';
import './features/stickers';

function prepareMiddleware(ctx: AobaContext, next: () => Promise<void>): Promise<void> {
  if (ctx.from) {
    ctx.userDisplay = formatUser(ctx.from);
    ctx.logger = logger.child({ user: formatUser(ctx.from) });
  }
  return next();
}

async function main(): Promise<void> {
  const token = process.env.AOBA_BOT_TOKEN;
  if (!token) {
    throw new Error('AOBA_BOT_TOKEN is not set in the environment variables');
  }

  logger.info('init db...');
  await migrator.migrateToLatest();

  const bot = new Telegraf<AobaContext>(token);
  bot.context.logger = logger;
  bot.botInfo = await bot.telegram.getMe();
  bot.use(prepareMiddleware);
  bot.catch((err, ctx) => {
    ctx.logger.error({ err }, 'Uncaught error: chat=%o from=%o', ctx.chat, ctx.from);
  });

  await initializeBot(bot);
  // default inline query after initialization
  bot.on('inline_query', async (ctx) => {
    await ctx.answerInlineQuery([], { cache_time: 10 });
  });

  bot.launch({
    // 忽略历史消息
    dropPendingUpdates: true,
  });

  logger.info('Aoba Bot is running...');
  logger.info('Bot info: %o', bot.botInfo);

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Caught an error while starting the bot');
});
