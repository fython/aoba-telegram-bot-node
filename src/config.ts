import { logger } from './logger';
import { RedirectPolicy, ReserveRule } from './utils/urlCleaner';
import { readFile } from 'fs/promises';

export interface AobaConfigObj {
  features: AobaConfigFeatures;
}

export interface AobaConfigFeatures {
  urlCleaner?: AobaConfigUrlCleanerFeature;
}

export interface AobaConfigUrlCleanerFeature {
  followRedirect?: RedirectPolicy;
  reserveRules?: ReserveRule[];
  userAgent?: string;
  autoCleanGroups?: AobaConfigUrlCleanerAutoCleanGroups[];
}

export interface AobaConfigUrlCleanerAutoCleanGroups {
  chatId: string;
  urlMatches: string[];
}

export async function readConfig(path: string): Promise<AobaConfigObj> {
  try {
    const data = await readFile(path, 'utf-8');
    const config: AobaConfigObj = JSON.parse(data);
    // TODO Schema validation can be added here
    return config;
  } catch (err) {
    logger.error({ err }, `Error reading config file at %s`, path);
    throw err;
  }
}
