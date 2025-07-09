import { Convenience as tt } from 'telegraf/types';

import { AobaContext } from '../context';

export function extraReplyToCurrent(ctx: AobaContext): tt.ExtraReplyMessage {
  if (!ctx.message?.message_id) {
    throw new Error('No message to reply to');
  }
  return {
    reply_parameters: {
      message_id: ctx.message?.message_id,
    },
  };
}
