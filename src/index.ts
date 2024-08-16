import { existsSync, rmSync, mkdirSync } from 'fs';
import { mkdir as mkdirAsync, rm as rmAsync } from 'fs/promises';

import path from 'path';

import { sync as ezspawnSync, async as ezspawnAsync } from '@jsdevtools/ez-spawn';
import type ezSpawn from '@jsdevtools/ez-spawn';

import { platform } from 'process';
import { tmpdir } from 'os';
import gensync from 'gensync';

import { getRootFromName, withSudo } from './utils';
import { getLogger } from './logger';

const ezspawn = gensync<[string], ezSpawn.Process>({
  sync: ezspawnSync,
  async: ezspawnAsync
});

const BLOCK_SIZE = 512;

const mkdir = gensync({
  sync: mkdirSync,
  async: mkdirAsync
});

export interface CreateOptions {
  /** @default true */
  quiet?: boolean,
  /** @default false */
  throwOnNotSupportedPlatform?: boolean
}

export const create = gensync(function *(name: string, bytes: number, {
  quiet = true,
  throwOnNotSupportedPlatform = false
}: CreateOptions = {}) {
  const logger = getLogger(quiet);

  if (platform === 'darwin' || platform === 'linux') {
    const root = getRootFromName(name);

    if (existsSync(root)) {
      logger.warn(`The path "${root}" already exists, skipping creation`);
      return root;
    }

    const tipInit = 'Initializing RAM disk. You may be prompted for credentials';
    const tipMount = 'Mouting RAM disk. You may be prompted for credentials';

    switch (platform) {
      case 'darwin': {
        const darwinBlocks = bytes / BLOCK_SIZE;

        logger.info(tipInit);
        const diskPath = (yield *ezspawn(`hdiutil attach -nomount ram://${darwinBlocks}`)).stdout.trim();
        logger.info(tipMount);
        yield *ezspawn(`diskutil erasevolume HFS+ ${name} ${diskPath}`);

        break;
      }
      case 'linux': {
        logger.info(tipInit);
        yield *ezspawn(yield *withSudo(`mkdir -p ${root}`));
        logger.info(tipMount);
        yield *ezspawn(yield *withSudo(`mount -t tmpfs -o size=${bytes} tmpfs ${root}`));

        break;
      }
      default: {
        throw new Error('Unsupported platform!');
      }
    }

    logger.info(`RAM disk is avaliable at ${root}`);

    return root;
  }

  if (throwOnNotSupportedPlatform) {
    throw new Error(`Unsupported platform "${platform}"`);
  }

  const root = path.join(tmpdir(), '.mocked-memdisk', name);

  logger.warn(`The current platform "${platform}" does not support RAM disks. A temporary directory (which may or may not exists in the RAM) is created at "${root}".`);

  yield *mkdir(root, { recursive: true });

  return root;
});

const rm = gensync({
  sync: rmSync,
  async: rmAsync
});

export type DestroyOptions = CreateOptions;

export const destroy = gensync(function *(root: string, {
  quiet = true,
  throwOnNotSupportedPlatform = false
}: DestroyOptions = {}) {
  const logger = getLogger(quiet);

  if (platform === 'darwin' || platform === 'linux') {
    logger.info(`Unmouting RAM disk at ${root}. You may be prompted for credentials`);

    switch (platform) {
      case 'darwin': {
        yield *ezspawn(`hdiutil detach ${root}`);
        return;
      }
      case 'linux': {
        yield *ezspawn(yield *withSudo(`umount ${root}`));
        return;
      }
      default: {
        throw new Error('Unsupported platform');
      }
    }
  }

  if (throwOnNotSupportedPlatform) {
    throw new Error(`Unsupported platform "${platform}"`);
  }

  const tipPrefix = `Current platform "${platform}" does not support RAM disks, attempted to remove the directory "${root}"`;

  try {
    yield *rm(root, { recursive: true, force: true });

    logger.warn(`${tipPrefix} and successed.`);
  } catch (e) {
    let message = `${tipPrefix} but failed`;
    if (typeof e === 'object' && e) {
      if ('code' in e && typeof e.code === 'string') {
        message += ' ' + e.code;
      }
      if ('message' in e && typeof e.message === 'string') {
        message += ' ' + e.message;
      }
    }

    logger.warn(message);
  }
});
