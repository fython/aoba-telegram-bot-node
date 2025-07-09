/**
 * Refactor from https://github.com/fython/url-track-cleaner-rs
 */
import { Logger } from 'pino';

import { logger } from '../logger';

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36';

export type RedirectPolicy =
  | { type: 'none' }
  | { type: 'all' }
  | { type: 'domains'; domains: string[] };

export function redirectPolicyNone(): RedirectPolicy {
  return { type: 'none' };
}

export function redirectPolicyAll(): RedirectPolicy {
  return { type: 'all' };
}

export function redirectPolicyDomains(domains: string[]): RedirectPolicy {
  return { type: 'domains', domains };
}

export function testRedirectPolicy(policy: RedirectPolicy, url: string): boolean {
  if (policy.type === 'none') {
    return false;
  } else if (policy.type === 'all') {
    return true;
  } else if (policy.type === 'domains') {
    const urlObj = new URL(url);
    return policy.domains.some((domain) => urlObj.hostname === domain);
  }
  return false;
}

export interface ReserveRule {
  urlMatch: string | RegExp;
  reserveQueryKeys: string[];
}

export function createReserveRule(
  urlMatch: string | RegExp,
  reserveQueryKeys: string[]
): ReserveRule {
  return { urlMatch, reserveQueryKeys };
}

export type RequestInitFn = (url: string) => RequestInit;

/**
 * UrlTrackCleaner 类用于清理 URL 中的跟踪参数。
 * 它支持跟随重定向、保留特定查询参数，并提供快速清理方法。
 */
export class UrlTrackCleaner {
  private followRedirect: RedirectPolicy;
  private reserveRules: ReserveRule[];
  private userAgent: string;
  private requestInitFn: RequestInitFn | null;
  private logger: Logger;

  /**
   * 构造函数，初始化 URL 清理器。
   * @param followRedirect 跟随重定向策略
   * @param reserveRules 保留规则数组，每个规则包含 URL 匹配模式和要保留的查询参数键
   * @param userAgent 用户代理字符串，默认为一个常见的浏览器用户代理
   * @param requestInitFn 可选的请求初始化函数，用于自定义请求参数
   * @returns 返回 UrlTrackCleaner 实例
   */
  constructor(
    followRedirect: RedirectPolicy = redirectPolicyNone(),
    reserveRules: ReserveRule[] = [],
    userAgent: string = DEFAULT_USER_AGENT,
    requestInitFn: RequestInitFn | null = null
  ) {
    this.followRedirect = followRedirect;
    this.reserveRules = reserveRules;
    this.userAgent = userAgent;
    this.requestInitFn = requestInitFn;
    this.logger = logger.child({ feature: 'urlCleaner' });
  }

  /**
   * 清理 URL 中的跟踪参数，并返回清理后的 URL。
   *
   * 清理逻辑：
   * 1. 如果 allowRedirect 为 true，且 this.followRedirect 允许重定向，则先测试请求 URL 是否需要重定向；
   * 2. 如果不需要重定向，直接使用原始 URL 继续处理；如果需要重定向，则根据重定向结果继续处理；
   * 3. 对于每个保留规则，检查 URL 是否匹配，如果匹配，则保留指定的查询参数；
   * 4. 对于不匹配的规则，移除所有跟踪参数；
   * 5. 最后返回清理后的 URL 对象。
   *
   * @param urlRaw - 原始 URL，可以是字符串或 URL 对象。
   * @param allowRedirect - 是否允许重定向，默认为 true。
   * @returns 返回清理后的 URL 对象。
   */
  async cleanUrl(urlRaw: string | URL, allowRedirect = true): Promise<URL> {
    let url: URL;

    if (typeof urlRaw === 'string') {
      url = new URL(urlRaw);
    } else {
      url = urlRaw;
    }

    // 如果允许重定向，且 followRedirect 允许重定向，则测试请求 URL 是否需要重定向
    if (allowRedirect && testRedirectPolicy(this.followRedirect, url.href)) {
      this.logger.debug('Testing URL for redirection: %s', url.href);
      const requestInit: RequestInit = { method: 'GET', headers: { 'User-Agent': this.userAgent } };
      if (this.requestInitFn) {
        const customInit = this.requestInitFn(url.href);
        Object.assign(requestInit, customInit);
      }

      const response = await fetch(url.href, requestInit);
      if (response.redirected) {
        this.logger.debug('URL redirected to: %s', response.url);
        url = new URL(response.url);
      } else {
        this.logger.debug('URL did not redirect: %o', response);
      }
    }

    return this._cleanQueryParams(url);
  }

  /**
   * 快速清理 URL 中的跟踪参数，并返回清理后的 URL。
   * 此方法不处理重定向，直接清理查询参数。
   *
   * 清理逻辑：
   * 1. 对于每个保留规则，检查 URL 是否匹配，如果匹配，则保留指定的查询参数；
   * 2. 对于不匹配的规则，移除所有跟踪参数；
   * 3. 最后返回清理后的 URL 对象。
   *
   * @param urlRaw - 原始 URL，可以是字符串或 URL 对象。
   * @returns 返回清理后的 URL 对象。
   */
  cleanUrlFast(urlRaw: string | URL): URL {
    let url: URL;

    if (typeof urlRaw === 'string') {
      url = new URL(urlRaw);
    } else {
      url = urlRaw;
    }

    return this._cleanQueryParams(url);
  }

  private _cleanQueryParams(url: URL): URL {
    // 遍历保留规则，检查 URL 是否匹配
    for (const rule of this.reserveRules) {
      let urlMatch: RegExp;
      if (typeof rule.urlMatch === 'string') {
        urlMatch = new RegExp(rule.urlMatch);
      } else {
        urlMatch = rule.urlMatch;
      }

      if (urlMatch.test(url.href)) {
        this.logger.debug('Matched URL using rule: %o', rule);
        const queryParams = new URLSearchParams(url.search);
        for (const key of [...queryParams.keys()]) {
          if (!rule.reserveQueryKeys.includes(key)) {
            this.logger.debug('Removing query parameter: %s', key);
            queryParams.delete(key);
          }
        }
        url.search = queryParams.toString();
        return url;
      }
    }

    // 如果没有匹配的规则，移除所有跟踪参数
    const allQueryParams = new URLSearchParams(url.search);
    for (const key of allQueryParams.keys()) {
      allQueryParams.delete(key);
    }
    url.search = allQueryParams.toString();

    return url;
  }
}

/**
 * 比较两个 URL 是否相似。
 *
 * 相似的定义为：主机名和路径相同，且查询参数相同（忽略顺序）。
 * 如果两个 URL 的主机名和路径相同，但查询参数不同，则认为它们不相似。
 * 如果两个 URL 的主机名和路径不同，则认为它们不相似。
 * 此函数会移除 URL 的末尾斜杠，并比较主机名、路径和查询参数。
 *
 * @param url1 第一个 URL，可以是字符串或 URL 对象。
 * @param url2 第二个 URL，可以是字符串或 URL 对象。
 * @returns 如果两个 URL 相似，则返回 true，否则返回 false。
 */
export function isUrlSimilar(url1: string | URL, url2: string | URL): boolean {
  const u1 = typeof url1 === 'string' ? new URL(url1) : url1;
  const u2 = typeof url2 === 'string' ? new URL(url2) : url2;

  const u1Href = u1.href.replace(/\/$/, ''); // 移除末尾斜杠
  const u2Href = u2.href.replace(/\/$/, ''); // 移除末尾斜杠
  if (u1Href === u2Href) {
    return true;
  }
  // 比较主机名+路径相同的情况下，query 重排序后是否相同
  // 先判断主机名+路径是否相同
  if (u1.hostname !== u2.hostname || u1.pathname !== u2.pathname) {
    return false;
  }
  // 比较 query 参数
  const u1Query = new URLSearchParams(u1.search);
  const u2Query = new URLSearchParams(u2.search);
  if (u1Query.size !== u2Query.size) {
    return false;
  }
  for (const [key, value] of u1Query.entries()) {
    if (u2Query.get(key) !== value) {
      return false;
    }
  }
  return true;
}
