import 'dotenv/config';
import { Telegraf } from 'telegraf';

import { readConfig } from './config';
import { AobaContext, setupAobaContext } from './context';
import { migrator } from './database';
import { formatUser } from './formatter/user';
import { logger } from './logger';
import { initializeBot } from './registry';

function prepareMiddleware(ctx: AobaContext, next: () => Promise<void>): Promise<void> {
  if (ctx.from) {
    ctx.userDisplay = formatUser(ctx.from);
    ctx.logger = logger.child({ user: formatUser(ctx.from) });
  }
  return next();
}

async function initFeatureImports(): Promise<void> {
  await Promise.all([
    import('./features/choose.js'),
    import('./features/help.js'),
    import('./features/ids.js'),
    import('./features/repeat.js'),
    import('./features/replace.js'),
    import('./features/stickers.js'),
    import('./features/urlCleaner.js'),
    import('./features/userInteract.js'),
    import('./features/version.js'),
    import('./features/yulu.js'),
    import('./features/aiChat.js'),
  ]);
}

async function main(): Promise<void> {
  const token = process.env.AOBA_BOT_TOKEN;
  if (!token) {
    throw new Error('AOBA_BOT_TOKEN is not set in the environment variables');
  }
  const configPath = process.env.AOBA_CONFIG_PATH || './config.json';
  logger.info('Using config path: %s', configPath);
  const config = await readConfig(configPath);

  // 初始化数据库
  logger.info('init db...');
  await migrator.migrateToLatest();

  // 初始化 Telegraf Bot
  const bot = new Telegraf<AobaContext>(token);
  // 设置通用上下文属性
  setupAobaContext(bot, config);
  bot.botInfo = await bot.telegram.getMe();
  // 通用处理逻辑 & 错误捕获
  bot.use(prepareMiddleware);
  bot.catch((err, ctx) => {
    ctx.logger.error({ err }, 'Uncaught error: chat=%o from=%o', ctx.chat, ctx.from);
  });
  // 初始化 features
  await initializeBot(bot);
  bot.on('inline_query', async (ctx) => {
    await ctx.answerInlineQuery([], { cache_time: 10 });
  });

  // 启动 Bot
  bot.launch({
    // 忽略历史消息
    dropPendingUpdates: true,
  });

  logger.info('Aoba Bot is running...');
  logger.info('Bot info: %o', bot.botInfo);

  process.once('SIGINT', () => {
    logger.warn('Received SIGINT, stopping bot...');
    bot.stop('SIGINT');
  });
  process.once('SIGTERM', () => {
    logger.warn('Received SIGTERM, stopping bot...');
    bot.stop('SIGTERM');
  });
}

initFeatureImports()
  .then(main)
  .catch((err) => {
    logger.error({ err }, 'Caught an error while starting the bot');
  });
