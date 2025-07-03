import { message } from 'telegraf/filters';
import { onBotInit } from '../registry';
import { db } from '../database';
import { NewRepeatMessage, NewRepeatCooldown } from '../database/models';
import { createHash } from 'crypto';
import { logger } from '../logger';

// 配置常量
const REPEAT_TIME_WINDOW = 5 * 60 * 1000; // 5分钟内的重复消息有效
const COOLDOWN_TIME = 10 * 60 * 1000; // 10分钟冷却时间
const CLEANUP_INTERVAL = 30 * 60 * 1000; // 30分钟清理一次过期记录
const MIN_MESSAGE_LENGTH = 2; // 最短消息长度
const MAX_MESSAGE_LENGTH = 100; // 最长消息长度

/**
 * 生成消息哈希值，用于避免存储长文本并提高查询效率
 */
function generateMessageHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * 计算复读概率
 * 2人复读: 50% 概率
 * 3人复读: 90% 概率
 * 4人及以上: 95% 概率
 */
function calculateRepeatProbability(userCount: number): number {
  if (userCount < 2) return 0;
  if (userCount === 2) return 0.5;
  if (userCount === 3) return 0.9;
  return 0.95;
}

/**
 * 检查消息是否在冷却期内
 */
async function isInCooldown(chatId: number, messageText: string): Promise<boolean> {
  const cooldownThreshold = new Date(Date.now() - COOLDOWN_TIME);

  const result = await db
    .selectFrom('repeat_cooldown')
    .select('id')
    .where('chat_id', '=', chatId)
    .where('message_text', '=', messageText)
    .where('created_at', '>', cooldownThreshold)
    .executeTakeFirst();

  return !!result;
}

/**
 * 添加冷却记录
 */
async function addCooldown(chatId: number, messageText: string): Promise<void> {
  const newCooldown: NewRepeatCooldown = {
    chat_id: chatId,
    message_text: messageText,
  };

  await db.insertInto('repeat_cooldown').values(newCooldown).execute();
}

/**
 * 记录用户复读消息并返回当前复读用户数量
 * 使用 INSERT ON CONFLICT DO NOTHING 来避免并发冲突
 */
async function recordRepeatMessage(
  chatId: number,
  messageText: string,
  userId: number
): Promise<number> {
  const messageHash = generateMessageHash(messageText);
  const timeThreshold = new Date(Date.now() - REPEAT_TIME_WINDOW);

  try {
    // 尝试插入新记录，如果已存在则忽略（防止同一用户重复记录）
    const newMessage: NewRepeatMessage = {
      chat_id: chatId,
      message_text: messageText,
      message_hash: messageHash,
      user_id: userId,
    };

    await db.insertInto('repeat_message').values(newMessage).execute();
  } catch (e) {
    logger.warn('Error inserting repeat message: %o', e);
  }

  // 统计时间窗口内的不同用户数量
  logger.debug(
    'messageHash: %s, chatId: %d, timeThreshold: %s',
    messageHash,
    chatId,
    timeThreshold.toISOString()
  );
  const result = await db
    .selectFrom('repeat_message')
    .select((eb) => eb.fn.countAll().as('user_count'))
    .where('chat_id', '=', chatId)
    .where('message_hash', '=', messageHash)
    .where('created_at', '>', timeThreshold)
    .executeTakeFirst();
  logger.debug('result: %o', result);

  return Number(result?.user_count || 0);
}

/**
 * 清理过期记录
 */
async function cleanupExpiredRecords(): Promise<void> {
  const timeThreshold = new Date(Date.now() - REPEAT_TIME_WINDOW);
  const cooldownThreshold = new Date(Date.now() - COOLDOWN_TIME);

  // 清理过期的复读消息记录
  await db.deleteFrom('repeat_message').where('created_at', '<', timeThreshold).execute();

  // 清理过期的冷却记录
  await db.deleteFrom('repeat_cooldown').where('created_at', '<', cooldownThreshold).execute();
}

/**
 * 检查消息是否适合复读
 */
function isMessageSuitableForRepeat(text: string): boolean {
  // 过滤掉命令消息
  if (text.startsWith('/')) {
    return false;
  }

  // 检查长度
  if (text.length < MIN_MESSAGE_LENGTH || text.length > MAX_MESSAGE_LENGTH) {
    return false;
  }

  // 过滤掉包含URL的消息
  if (text.includes('http://') || text.includes('https://') || text.includes('www.')) {
    return false;
  }

  // 过滤掉包含@的消息（可能是用户名或邮箱）
  if (text.includes('@')) {
    return false;
  }

  return true;
}

export const init = () =>
  onBotInit(async (bot) => {
    // 设置定期清理任务
    setInterval(cleanupExpiredRecords, CLEANUP_INTERVAL);

    bot.on(message('text'), async (ctx, next) => {
      // 只处理群组消息
      if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
        return next();
      }

      // 忽略机器人自己的消息
      if (ctx.from.id === bot.botInfo?.id) {
        return next();
      }

      const text = ctx.text.trim();

      // 检查消息是否适合复读
      if (!isMessageSuitableForRepeat(text)) {
        return next();
      }

      ctx.logger = ctx.logger.child({ feature: 'repeat' });

      try {
        const chatId = ctx.chat.id;

        // 检查是否在冷却期内
        if (await isInCooldown(chatId, text)) {
          ctx.logger.debug('Message in cooldown, skipping repeat for: %s', text);
          return next();
        }

        // 记录用户复读消息
        const userCount = await recordRepeatMessage(chatId, text, ctx.from.id);

        // 计算复读概率
        const probability = calculateRepeatProbability(userCount);

        const rand = Math.random();
        ctx.logger.info(
          'repeating users: %d, probability: %f, rand: %f, text: %s',
          userCount,
          probability,
          rand,
          text
        );
        if (probability > 0 && rand < probability) {
          // 发送复读消息
          await ctx.reply(text);

          // 添加冷却记录
          await addCooldown(chatId, text);
        } else {
          ctx.logger.debug(
            'Not repeating message with %d users, probability: %f, text: %s',
            userCount,
            probability,
            text
          );
        }
      } catch (error) {
        ctx.logger.error('Error in repeat feature: %o', error);
      }

      return next();
    });
  });

// 检查是否启用复读机功能
if (process.env.AOBA_FEATURE_REPEAT_DISABLED !== '1') {
  init();
}
