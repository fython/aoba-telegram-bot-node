import { Logger } from 'pino';
import { Context, NarrowedContext } from 'telegraf';
import { Update } from 'telegraf/types';

export interface AobaContext extends Context {
  logger: Logger;
  userDisplay?: string;
}

export type NarrowedAobaContext<U extends Update> = NarrowedContext<AobaContext, U>;
