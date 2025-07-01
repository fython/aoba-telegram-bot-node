import { readFileSync } from 'fs';
import { join } from 'path';

export interface VersionInfo {
  gitCommitHash: string;
  gitTag: string;
  gitCommitMessage: string;
  buildDate: string;
}

/**
 * 获取版本信息（从环境变量或版本文件）
 */
export function getVersionInfo(): VersionInfo {
  // 优先从环境变量获取
  if (process.env.GIT_COMMIT_HASH) {
    return {
      gitCommitHash: process.env.GIT_COMMIT_HASH || 'unknown',
      gitTag: process.env.GIT_TAG || 'unknown',
      gitCommitMessage: process.env.GIT_COMMIT_MESSAGE || 'unknown',
      buildDate: process.env.BUILD_DATE || 'unknown',
    };
  }

  // 尝试从版本文件读取
  try {
    const versionFilePath = join(process.cwd(), 'version.json');
    const versionContent = readFileSync(versionFilePath, 'utf-8');
    return JSON.parse(versionContent) as VersionInfo;
  } catch {
    // 如果都没有，返回默认值
    return {
      gitCommitHash: 'development',
      gitTag: 'development',
      gitCommitMessage: 'development',
      buildDate: new Date().toISOString(),
    };
  }
}

/**
 * 获取短版本的 commit hash（前8位）
 */
export function getShortCommitHash(): string {
  const versionInfo = getVersionInfo();
  return versionInfo.gitCommitHash.substring(0, 8);
}

/**
 * 获取格式化的版本字符串
 */
export function getVersionString(): string {
  const versionInfo = getVersionInfo();
  const shortHash = getShortCommitHash();

  if (versionInfo.gitTag && versionInfo.gitTag !== 'no-tag' && versionInfo.gitTag !== 'unknown') {
    return `${versionInfo.gitTag} (${shortHash})`;
  }

  return shortHash;
}

export function getVersionMessageForBot(): string {
  const versionInfo = getVersionInfo();
  const shortHash = getShortCommitHash();
  let response = '';
  if (versionInfo.gitTag && versionInfo.gitTag !== 'no-tag' && versionInfo.gitTag !== 'unknown') {
    response += `🏷️ **版本标签**: ${versionInfo.gitTag}\n`;
  }

  if (versionInfo.gitCommitMessage && versionInfo.gitCommitMessage !== 'unknown') {
    response += `💬 **最后提交**: (\`${shortHash}\`) ${versionInfo.gitCommitMessage}\n`;
  }

  if (versionInfo.buildDate && versionInfo.buildDate !== 'unknown') {
    const buildDate = new Date(versionInfo.buildDate);
    response += `📅 **构建时间**: ${buildDate.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n`;
  }
  return response;
}
