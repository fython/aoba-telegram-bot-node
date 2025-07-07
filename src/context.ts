import { Logger } from 'pino';
import { Context, NarrowedContext, Telegraf } from 'telegraf';
import { Update } from 'telegraf/types';
import { redirectPolicyNone, UrlTrackCleaner } from './utils/urlCleaner';
import { AobaConfigObj } from './config';
import { logger } from './logger';

export interface AobaContext extends Context {
  logger: Logger;
  config: AobaConfigObj;
  urlCleaner: UrlTrackCleaner;
  userDisplay?: string;
}

export type NarrowedAobaContext<U extends Update> = NarrowedContext<AobaContext, U>;

export function setupAobaContext(bot: Telegraf<AobaContext>, config: AobaConfigObj): void {
  bot.context.logger = logger;
  bot.context.config = config;
  bot.context.urlCleaner = new UrlTrackCleaner(
    config.features.urlCleaner?.followRedirect ?? redirectPolicyNone(),
    config.features.urlCleaner?.reserveRules ?? [],
    config.features.urlCleaner?.userAgent
  );
  logger.debug('urlCleaner: %o', bot.context.urlCleaner);
}
