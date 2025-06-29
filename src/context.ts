import { Logger } from 'pino';
import { Context } from 'telegraf';

export interface AobaContext extends Context {
  logger: Logger;
  userDisplay?: string;
}
