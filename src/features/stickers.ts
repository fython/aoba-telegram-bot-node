import { message } from 'telegraf/filters';
import { onBotInit } from '../registry';
import { extraReplyToCurrent } from '../utils';
import { Message, Sticker, Update } from 'telegraf/types';
import sharp from 'sharp';
import { Telegraf } from 'telegraf';
import { AobaContext, NarrowedAobaContext } from '../context';

async function downloadStickerAndReply(
  bot: Telegraf<AobaContext>,
  ctx: NarrowedAobaContext<Update.MessageUpdate<Message.StickerMessage>>
): Promise<void> {
  const sticker = ctx.message.sticker;
  if (sticker.is_animated || sticker.is_video) {
    ctx.logger.warn('Animated or video stickers are not supported for download');
    await ctx.reply('抱歉，暂不支持下载动画或视频贴纸。');
    return;
  }
  try {
    const stickerFile = await bot.telegram.getFile(sticker.file_id);
    const stickerFilePath = stickerFile.file_path;
    if (!stickerFilePath) {
      ctx.logger.warn('Sticker file path is not available, cannot download the sticker');
      return;
    }
    const stickerFileUrl = `https://api.telegram.org/file/bot${process.env.AOBA_BOT_TOKEN}/${stickerFilePath}`;
    ctx.logger.info('Downloading sticker file from URL: %s', stickerFileUrl);
    const stickerBuffer = await fetch(stickerFileUrl).then((res) => res.arrayBuffer());
    // WebP 转 PNG
    const stickerPng = await sharp(stickerBuffer).png().toBuffer();

    await ctx.replyWithDocument({
      source: stickerPng,
      filename: sticker.file_unique_id + '.png',
    });
  } catch (err) {
    ctx.logger.error({ err }, 'Failed to download sticker: %s', sticker.file_id);
    await ctx.reply('下载贴纸失败，请稍后再试。');
  }
}

onBotInit(async (bot) => {
  bot.on(message('sticker'), async (ctx, next) => {
    if (ctx.chat.type !== 'private') {
      return next();
    }

    // 获取当前 Sticker 的信息，并回复展示给用户
    const sticker = ctx.message.sticker;
    ctx.logger.info('requested sticker info: %o', sticker);
    const stickerFieldName: Record<keyof Sticker, string> = {
      file_id: '文件 ID',
      file_unique_id: '唯一文件 ID',
      type: '类型',
      width: '宽度',
      height: '高度',
      is_animated: '是否动画',
      is_video: '是否视频',
      thumbnail: '缩略图',
      emoji: 'Emoji',
      set_name: '贴纸集名称',
      premium_animation: '高级动画',
      mask_position: '遮罩位置',
      custom_emoji_id: '自定义表情 ID',
      file_size: '文件大小',
    };
    let text = '';
    for (const key of Object.keys(sticker) as (keyof Sticker)[]) {
      const value = sticker[key];
      if (value !== undefined) {
        let v = value;
        if (typeof value === 'object') {
          v = JSON.stringify(value);
        }
        text += `*${stickerFieldName[key] || key}*: \`${v}\`\n`;
      }
    }
    await Promise.all([
      ctx.reply(text, { ...extraReplyToCurrent(ctx), parse_mode: 'MarkdownV2' }),
      downloadStickerAndReply(bot, ctx),
    ]);
  });
});
