import { existsSync, rmSync, mkdirSync } from 'fs';
import { mkdir as mkdirAsync, rm as rmAsync } from 'fs/promises';

import path from 'path';

import { sync as ezspawnSync, async as ezspawnAsync } from '@jsdevtools/ez-spawn';
import type ezSpawn from '@jsdevtools/ez-spawn';

import { platform } from 'process';
import { tmpdir } from 'os';
import gensync from 'gensync';

import { getRootFromName, withSudo } from './utils';
import { getLogger, type Logger } from './logger';

const ezspawn = gensync<[string], ezSpawn.Process>({
  sync: ezspawnSync,
  async: ezspawnAsync
});

const BLOCK_SIZE = 512;

const mkdir = gensync({
  sync: mkdirSync,
  async: mkdirAsync
});

const rm = gensync({
  sync: rmSync,
  async: rmAsync
});

const tips = {
  init: 'Initializing RAM disk. You may be prompted for credentials',
  mount: 'Mouting RAM disk. You may be prompted for credentials',
  destroy: (root: string) => `Unmouting RAM disk at ${root}. You may be prompted for credentials`
};

export type SupportedPlatform = 'darwin' | 'linux';
export const isSupportedPlatform = (platform: string): platform is SupportedPlatform => platform === 'darwin' || platform === 'linux';

const $notSupported = Symbol('not supported');

const op = (logger: Logger) => ({
  darwin: {
    create: gensync(function *(name: string, _root: string, bytes: number) {
      const darwinBlocks = bytes / BLOCK_SIZE;
      logger.info(tips.init);
      const diskPath = (yield *ezspawn(`hdiutil attach -nomount ram://${darwinBlocks}`)).stdout.trim();
      logger.info(tips.mount);
      yield *ezspawn(`diskutil erasevolume HFS+ ${name} ${diskPath}`);
    }),
    destroy: gensync(function *(root: string) {
      logger.info(tips.destroy(root));
      yield *ezspawn(`hdiutil detach ${root}`);
    })
  },
  linux: {
    create: gensync(function *(_name: string, root: string, bytes: number) {
      logger.info(tips.init);
      yield *ezspawn(yield *withSudo(`mkdir -p ${root}`));
      logger.info(tips.mount);
      yield *ezspawn(yield *withSudo(`mount -t tmpfs -o size=${bytes} tmpfs ${root}`));
    }),
    destroy: gensync(function *(root: string) {
      logger.info(tips.destroy(root));
      yield *ezspawn(yield *withSudo(`umount ${root}`));
    })
  },
  [$notSupported]: {
    create: gensync(function *(_name: string, root: string, _bytes: number) {
      logger.warn(`The current platform "${platform}" does not support RAM disks. A temporary directory (which may or may not exists in the RAM) is created at "${root}".`);

      yield *mkdir(root, { recursive: true });
    }),
    destroy: gensync(function *(root: string) {
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
    })
  }
});

export interface CreateOptions {
  /** @default true */
  quiet?: boolean,
  /** @default false */
  throwOnNotSupportedPlatform?: boolean
}

const abortNotSupported = (shouldThrow: boolean) => {
  if (shouldThrow) {
    throw new Error(`Unsupported platform "${platform}"`);
  }
};

export const create = gensync(function *(name: string, bytes: number, {
  quiet = true,
  throwOnNotSupportedPlatform = false
}: CreateOptions = {}) {
  const logger = getLogger(quiet);

  if (isSupportedPlatform(platform)) {
    const root = getRootFromName(name);

    if (existsSync(root)) {
      logger.warn(`The path "${root}" already exists, skipping creation`);
      return root;
    }

    yield *op(logger)[platform].create(name, root, bytes);

    logger.info(`RAM disk is avaliable at ${root}`);

    return root;
  }

  abortNotSupported(throwOnNotSupportedPlatform);

  const root = path.join(tmpdir(), '.mocked-memdisk', name);
  yield *op(logger)[$notSupported].create(name, root, bytes);
  return root;
});

export type DestroyOptions = CreateOptions;

export const destroy = gensync(function *(root: string, {
  quiet = true,
  throwOnNotSupportedPlatform = false
}: DestroyOptions = {}) {
  const logger = getLogger(quiet);

  if (isSupportedPlatform(platform)) {
    yield *op(logger)[platform].destroy(root);
    return;
  }

  abortNotSupported(throwOnNotSupportedPlatform);

  yield *op(logger)[$notSupported].destroy(root);
});
