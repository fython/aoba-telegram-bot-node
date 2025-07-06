import { message } from 'telegraf/filters';
import { Update, Message } from 'telegraf/types';
import { onBotInit } from '../registry';
import { db } from '../database';
import { NewRepeatMessage, NewRepeatCooldown } from '../database/models';
import { createHash } from 'crypto';
import { logger } from '../logger';
import { NarrowedAobaContext } from '../context';

type RepeatContext = NarrowedAobaContext<
  Update.MessageUpdate<Message.TextMessage | Message.StickerMessage>
>;

// 配置常量
const REPEAT_TIME_WINDOW = 2 * 60 * 1000; // 5分钟内的重复消息有效
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
 * 生成 Sticker 的哈希值
 */
function generateStickerHash(fileUniqueId: string): string {
  return createHash('sha256').update(`sticker:${fileUniqueId}`).digest('hex');
}

/**
 * 消息类型定义
 */
type MessageInfo =
  | {
      type: 'text';
      text: string;
      hash: string;
    }
  | {
      type: 'sticker';
      fileId: string;
      fileUniqueId: string;
      hash: string;
    };

/**
 * 从 Telegram 消息中提取消息信息
 */
function extractMessageInfo(ctx: RepeatContext): MessageInfo | null {
  if (!ctx.message) {
    return null;
  }
  if ((ctx.message as Message.TextMessage).text) {
    const msg = ctx.message as Message.TextMessage;
    const text = msg.text.trim();
    if (isMessageSuitableForRepeat(text)) {
      return {
        type: 'text',
        text,
        hash: generateMessageHash(text),
      };
    }
  } else if ((ctx.message as Message.StickerMessage).sticker) {
    const msg = ctx.message as Message.StickerMessage;
    return {
      type: 'sticker',
      fileId: msg.sticker.file_id,
      fileUniqueId: msg.sticker.file_unique_id,
      hash: generateStickerHash(msg.sticker.file_unique_id),
    };
  }
  return null;
}

/**
 * 计算复读概率
 */
function calculateRepeatProbability(feature: 'text' | 'sticker', userCount: number): number {
  if (feature === 'sticker') {
    if (userCount < 2) return 0;
    if (userCount === 2) return 0.9;
    return 1.0;
  }
  if (userCount < 2) return 0;
  if (userCount === 2) return 0.5;
  if (userCount === 3) return 0.9;
  return 0.95;
}

/**
 * 检查消息是否在冷却期内
 */
async function isInCooldown(chatId: number, messageInfo: MessageInfo): Promise<boolean> {
  const cooldownThreshold = new Date(Date.now() - COOLDOWN_TIME);

  if (messageInfo.type === 'text') {
    const result = await db
      .selectFrom('repeat_cooldown')
      .select('id')
      .where('chat_id', '=', chatId)
      .where('message_type', '=', 'text')
      .where('message_text', '=', messageInfo.text)
      .where('created_at', '>', cooldownThreshold)
      .executeTakeFirst();
    return !!result;
  } else {
    const result = await db
      .selectFrom('repeat_cooldown')
      .select('id')
      .where('chat_id', '=', chatId)
      .where('message_type', '=', 'sticker')
      .where('sticker_file_unique_id', '=', messageInfo.fileUniqueId)
      .where('created_at', '>', cooldownThreshold)
      .executeTakeFirst();
    return !!result;
  }
}

/**
 * 添加冷却记录
 */
async function addCooldown(chatId: number, messageInfo: MessageInfo): Promise<void> {
  const newCooldown: NewRepeatCooldown = {
    chat_id: chatId,
    message_type: messageInfo.type,
    message_text: messageInfo.type === 'text' ? messageInfo.text : null,
    sticker_file_unique_id: messageInfo.type === 'sticker' ? messageInfo.fileUniqueId : null,
  };

  await db.insertInto('repeat_cooldown').values(newCooldown).execute();
}

/**
 * 记录用户复读消息并返回当前复读用户数量
 * 使用 INSERT ON CONFLICT DO NOTHING 来避免并发冲突
 */
async function recordRepeatMessage(
  chatId: number,
  messageInfo: MessageInfo,
  userId: number
): Promise<number> {
  const timeThreshold = new Date(Date.now() - REPEAT_TIME_WINDOW);

  try {
    // 尝试插入新记录，如果已存在则忽略（防止同一用户重复记录）
    const newMessage: NewRepeatMessage = {
      chat_id: chatId,
      message_type: messageInfo.type,
      message_text: messageInfo.type === 'text' ? messageInfo.text : null,
      message_hash: messageInfo.hash,
      user_id: userId,
      sticker_file_id: messageInfo.type === 'sticker' ? messageInfo.fileId : null,
      sticker_file_unique_id: messageInfo.type === 'sticker' ? messageInfo.fileUniqueId : null,
    };

    await db.insertInto('repeat_message').values(newMessage).execute();
  } catch (e) {
    logger.warn('Error inserting repeat message: %o', e);
  }

  // 统计时间窗口内的不同用户数量
  logger.debug(
    'messageHash: %s, chatId: %d, timeThreshold: %s',
    messageInfo.hash,
    chatId,
    timeThreshold.toISOString()
  );
  const result = await db
    .selectFrom('repeat_message')
    .select((eb) => eb.fn.countAll().as('user_count'))
    .where('chat_id', '=', chatId)
    .where('message_hash', '=', messageInfo.hash)
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

/**
 * 通用的消息处理逻辑，用于文本和贴纸
 */
async function handleRepeatableMessage(ctx: RepeatContext, next: () => Promise<void>) {
  // 只处理群组消息
  if (ctx.chat.type !== 'group' && ctx.chat.type !== 'supergroup') {
    return next();
  }

  // 忽略机器人自己的消息
  if (ctx.from.id === ctx.botInfo?.id) {
    return next();
  }

  const messageInfo = extractMessageInfo(ctx);
  if (!messageInfo) {
    return next();
  }

  ctx.logger = ctx.logger.child({ feature: 'repeat' });

  try {
    const chatId = ctx.chat.id;

    // 检查是否在冷却期内
    if (await isInCooldown(chatId, messageInfo)) {
      ctx.logger.debug('Message in cooldown, skipping repeat for: %s', messageInfo.type);
      return next();
    }

    // 记录用户复读消息
    const userCount = await recordRepeatMessage(chatId, messageInfo, ctx.from.id);

    // 计算复读概率
    const probability = calculateRepeatProbability(messageInfo.type, userCount);

    const rand = Math.random();
    ctx.logger.info(
      'repeating users: %d, probability: %f, rand: %f, type: %s, hash: %s',
      userCount,
      probability,
      rand,
      messageInfo.type,
      messageInfo.hash
    );

    if (probability > 0 && rand < probability) {
      // 根据消息类型发送复读
      if (messageInfo.type === 'text') {
        await ctx.reply(messageInfo.text);
      } else if (messageInfo.type === 'sticker') {
        await ctx.replyWithSticker(messageInfo.fileId);
      }

      // 添加冷却记录
      await addCooldown(chatId, messageInfo);
    } else {
      ctx.logger.debug(
        'Not repeating message with %d users, probability: %f, type: %s',
        userCount,
        probability,
        messageInfo.type
      );
    }
  } catch (error) {
    ctx.logger.error('Error in repeat feature: %o', error);
  }

  return next();
}

export const init = () =>
  onBotInit(async (bot) => {
    // 设置定期清理任务
    setInterval(cleanupExpiredRecords, CLEANUP_INTERVAL);

    // 处理文本和贴纸消息
    bot.on([message('text'), message('sticker')], handleRepeatableMessage);
  });

// 检查是否启用复读机功能
if (process.env.AOBA_FEATURE_REPEAT_DISABLED !== '1') {
  init();
}
