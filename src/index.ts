import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { mkdir as mkdirAsync, rm as rmAsync } from 'node:fs/promises';

import path from 'node:path';

import { sync as ezspawnSync, async as ezspawnAsync } from '@jsdevtools/ez-spawn';
import type ezSpawn from '@jsdevtools/ez-spawn';

import { platform } from 'node:process';
import { tmpdir } from 'node:os';
import gensync from 'gensync';

import { extractErrorMessage, getRootFromName, withSudo } from './utils';
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
    create: gensync(function *(name: string, _root: string, bytes: number, darwinUseHFSPlus: boolean) {
      const darwinBlocks = bytes / BLOCK_SIZE;
      logger.info(tips.init);
      const diskPath = (yield *ezspawn(`hdiutil attach -nomount ram://${darwinBlocks}`)).stdout.trim();
      logger.info(tips.mount);
      yield *ezspawn(`diskutil eraseVolume ${darwinUseHFSPlus ? 'HFS+' : 'APFS'} ${name} ${diskPath}`);
    }),
    destroy: gensync(function *(root: string, force: boolean) {
      logger.info(tips.destroy(root));
      let cmd = `hdiutil detach ${root}`;
      if (force) {
        cmd += ' -force';
      }
      yield *ezspawn(cmd);
    })
  },
  linux: {
    create: gensync(function *(_name: string, root: string, bytes: number, _darwinUseHFSPlus: boolean) {
      logger.info(tips.init);
      yield *ezspawn(yield *withSudo(`mkdir -p ${root}`));
      logger.info(tips.mount);
      yield *ezspawn(yield *withSudo(`mount -t tmpfs -o size=${bytes} tmpfs ${root}`));
    }),
    destroy: gensync(function *(root: string, force: boolean) {
      logger.info(tips.destroy(root));
      const cmd = force
        ? `umount --force ${root}`
        : `umount ${root}`;
      yield *ezspawn(yield *withSudo(cmd));
    })
  },
  [$notSupported]: {
    create: gensync(function *(_name: string, root: string, _bytes: number, _darwinUseHFSPlus: boolean) {
      logger.warn(`The current platform "${platform}" does not support RAM disks. A temporary directory (which may or may not exists in the RAM) is created at "${root}".`);

      yield *mkdir(root, { recursive: true });
    }),
    destroy: gensync(function *(root: string, _force: boolean) {
      const tipPrefix = `Current platform "${platform}" does not support RAM disks, attempted to remove the directory "${root}"`;

      try {
        yield *rm(root, { recursive: true, force: true });
        logger.warn(`${tipPrefix} and successed.`);
      } catch (e) {
        logger.warn(`${tipPrefix} but failed` + extractErrorMessage(e));
      }
    })
  }
});

export interface CreateOptions {
  /** @default true */
  quiet?: boolean,
  /** @default false */
  throwOnNotSupportedPlatform?: boolean,
  /** @default false */
  darwinUseHFSPlus?: boolean
}

const abortNotSupported = (shouldThrow: boolean) => {
  if (shouldThrow) {
    throw new Error(`Unsupported platform "${platform}"`);
  }
};

export interface DestroyOptions extends CreateOptions {
  force?: boolean
};

const $destroy = gensync(function *(root: string, {
  quiet = true,
  throwOnNotSupportedPlatform = false,
  force = true
}: DestroyOptions = {}) {
  const logger = getLogger(quiet);

  if (isSupportedPlatform(platform)) {
    yield *op(logger)[platform].destroy(root, force);
    return;
  }

  abortNotSupported(throwOnNotSupportedPlatform);

  yield *op(logger)[$notSupported].destroy(root, force);
});

const $create = gensync(function *(name: string, bytes: number, {
  quiet = true,
  throwOnNotSupportedPlatform = false,
  darwinUseHFSPlus = false
}: CreateOptions = {}) {
  const logger = getLogger(quiet);

  let root = getRootFromName(name);

  try {
    if (isSupportedPlatform(platform)) {
      if (existsSync(root)) {
        logger.warn(`The path "${root}" already exists, skipping creation`);
        return root;
      }

      yield *op(logger)[platform].create(name, root, bytes, darwinUseHFSPlus);

      logger.info(`RAM disk is avaliable at ${root}`);

      return root;
    }

    abortNotSupported(throwOnNotSupportedPlatform);

    root = path.join(tmpdir(), '.mocked-memdisk', name);
    yield *op(logger)[$notSupported].create(name, root, bytes, darwinUseHFSPlus);
    return root;
  } catch {
    const errMessage = `Failed to create RAM disk at ${root}`;

    if (existsSync(root)) {
      logger.error(`${errMessage}, clean it up`);

      yield *$destroy(root, { quiet, throwOnNotSupportedPlatform });
    }

    throw new Error(errMessage);
  }
});

type ErrorBack<R, E = unknown> = [R] extends [void] ? (err: E) => void : (err: E, result: R) => void;

interface Create {
  sync: (name: string, bytes: number, options?: CreateOptions) => string,
  async: (name: string, bytes: number, options?: CreateOptions) => Promise<string>,
  errback: (name: string, bytes: number, options: CreateOptions | undefined, callback: ErrorBack<string>) => void
}

export const create: Create = {
  sync: (...args) => $create.sync.apply(null, args),
  async: (...args) => $create.async.apply(null, args),
  errback: (...args) => $create.errback.apply(null, args)
};

interface Destroy {
  sync: (root: string, options?: DestroyOptions) => void,
  async: (root: string, options?: DestroyOptions) => Promise<void>,
  errback: (root: string, options: DestroyOptions | undefined, callback: ErrorBack<void>) => void
}

export const destroy: Destroy = {
  sync: (...args) => $destroy.sync.apply(null, args),
  async: (...args) => $destroy.async.apply(null, args),
  errback: (...args) => $destroy.errback.apply(null, args)
};
