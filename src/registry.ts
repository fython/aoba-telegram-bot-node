import { MiddlewareFn, NarrowedContext, Telegraf } from 'telegraf';
import { Convenience as tt } from 'telegraf/types';
import { AobaContext } from './context';
import { logger } from './logger';

export type BotInitFn = (bot: Telegraf<AobaContext>) => Promise<void>;

export interface BotCommandDescriptor {
  command: string;
  shortDesc: string;
  longDesc?: string;
  handler: MiddlewareFn<NarrowedContext<AobaContext, tt.MountMap['text']> & tt.CommandContextExtn>;
}

const botInitFunctions: BotInitFn[] = [];

const botCommands: BotCommandDescriptor[] = [];

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
}

export function getBotCommands(): BotCommandDescriptor[] {
  return botCommands;
}
