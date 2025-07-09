import { message } from 'telegraf/filters';
import { fmt } from 'telegraf/format';

import { userLink } from '../formatter/user';
import { onBotInit } from '../registry';

export const init = () =>
  onBotInit(async (bot) => {
    bot.on(message('text'), async (ctx, next) => {
      ctx.logger = ctx.logger.child({ feature: 'userInteract' });
      const text = ctx.text;
      const reply = ctx.message.reply_to_message;
      const replyFrom = ctx.message.reply_to_message?.from;
      if (!text || !reply || !replyFrom) {
        return next();
      }
      if (!text.startsWith('/')) {
        return next();
      }
      const action = text.split(' ')[0].slice(1);
      if (action.includes('@')) {
        return next();
      }
      const actor = userLink(ctx.from);
      const target = userLink(replyFrom);
      let suffix = text.split(' ').slice(1).join(' ').trim();
      if (suffix.length > 0) {
        suffix = ` ${suffix}`;
      }
      ctx.logger.info('actor:%o action:%s target:%o suffix:%s', actor, action, target, suffix);

      ctx.reply(fmt`${actor} ${action}了 ${target}${suffix}`, {
        reply_parameters: {
          message_id: reply.message_id,
        },
      });
    });
  });

if (process.env.AOBA_FEATURE_USER_INTERACT_DISABLED !== '1') {
  init();
}
