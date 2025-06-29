import pino from 'pino';
import { PinoPretty } from 'pino-pretty';

const pinoPretty = PinoPretty({
  colorize: true,
  ignore: 'pid,hostname,user,command,feature',
  messageFormat: (log, messageKey) => {
    let prefix = '';
    if (log.user) {
      prefix += `[user:${log.user}]`;
    }
    if (log.command) {
      prefix += `[command:${log.command}]`;
    }
    if (log.feature) {
      prefix += `[feature:${log.feature}]`;
    }
    if (prefix.length > 0) {
      prefix += ' ';
    }

    return `${prefix}${log[messageKey]}`;
  },
});

export const logger = pino(
  {
    name: 'aoba',
    level: process.env.AOBA_LOG_LEVEL || 'info',
  },
  pinoPretty
);
