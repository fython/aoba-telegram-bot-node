import { MiddlewareFn, NarrowedContext, Telegraf } from 'telegraf';
import { Convenience as tt } from 'telegraf/types';

import { AobaContext } from './context';

export type BotInitFn = (bot: Telegraf<AobaContext>) => Promise<void>;

export type BotSimpleHandler = (
  ctx: AobaContext,
  next: () => Promise<void>
) => Promise<void> | undefined;

export interface BotCommandDescriptor {
  command: string;
  shortDesc: string;
  longDesc?: string;
  handler: MiddlewareFn<NarrowedContext<AobaContext, tt.MountMap['text']> & tt.CommandContextExtn>;
}

const botInitFunctions: BotInitFn[] = [];

const botCommands: BotCommandDescriptor[] = [];

const botInlineQueryHandlers: BotSimpleHandler[] = [];

export function onBotInit(fn: BotInitFn): void {
  botInitFunctions.push(fn);
}

export function registerCommand(command: BotCommandDescriptor): void {
  if (!command.command || !command.handler) {
    throw new Error('Command must have a command string and a handler function');
  }
  if (!command.shortDesc) {
    throw new Error('Command must have a short description');
  }
  botCommands.push(command);
}

export function registerInlineQueryHandler(handler: BotSimpleHandler): void {
  if (typeof handler !== 'function') {
    throw new Error('Inline query handler must be a function');
  }
  botInlineQueryHandlers.push(handler);
}

export async function initializeBot(bot: Telegraf<AobaContext>): Promise<void> {
  for (const command of botCommands) {
    bot.command(command.command, (ctx, next) => {
      ctx.logger = ctx.logger.child({ command: command.command });
      return command.handler(ctx, next);
    });
  }
  await Promise.all(
    botInitFunctions.map(async (fn) => {
      await fn(bot);
    })
  );
  for (const h of botInlineQueryHandlers) {
    bot.on('inline_query', h);
  }
}

export function getBotCommands(): BotCommandDescriptor[] {
  return botCommands;
}
