/**
 * Telegram Markdown V2 字符转义工具函数
 *
 * @param text - 需要转义的文本
 * @returns 转义后的文本
 */
export function escapeMD(text: string): string {
  if (!text) return text;

  // 构建包含所有特殊字符的正则表达式
  const specialCharsRegex = /[_*[\]()~`>#+=|{}.!-]/g;

  return text.replace(specialCharsRegex, '\\$&');
}
