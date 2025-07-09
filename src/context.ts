import { Kysely } from 'kysely';
import { Logger } from 'pino';
import { Context, NarrowedContext, Telegraf } from 'telegraf';
import { Update } from 'telegraf/types';

import { AobaConfigObj } from './config';
import { AobaDatabase } from './database/models';
import { db } from './database/postgres';
import { logger } from './logger';
import { UrlTrackCleaner, redirectPolicyNone } from './utils/urlCleaner';

export interface AobaContext extends Context {
  logger: Logger;
  config: AobaConfigObj;
  urlCleaner: UrlTrackCleaner;
  userDisplay?: string;
  db: Kysely<AobaDatabase>;
}

export type NarrowedAobaContext<U extends Update> = NarrowedContext<AobaContext, U>;

export function setupAobaContext(bot: Telegraf<AobaContext>, config: AobaConfigObj): void {
  bot.context.logger = logger;
  bot.context.config = config;
  bot.context.db = db;
  bot.context.urlCleaner = new UrlTrackCleaner(
    config.features.urlCleaner?.followRedirect ?? redirectPolicyNone(),
    config.features.urlCleaner?.reserveRules ?? [],
    config.features.urlCleaner?.userAgent
  );
  logger.debug('urlCleaner: %o', bot.context.urlCleaner);
}
