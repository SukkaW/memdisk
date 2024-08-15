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

const init = gensync(function *(darwinBlocks: number, linuxRoot: string, logger: Logger) {
  if (platform === 'darwin' || platform === 'linux') {
    const commands = {
      darwin: `hdiutil attach -nomount ram://${darwinBlocks}`,
      linux: yield *withSudo(`mkdir -p ${linuxRoot}`)
    };

    logger.info('Initializing RAMdisk. You may be prompted for credentials');
    const diskPath = (yield *ezspawn(commands[platform])).stdout;
    return diskPath.trim();
  }

  throw new Error('Unsupported platform!');
});

const mount = gensync(function *(bytes: number, diskPath: string, darwinName: string, linuxRoot: string, logger: Logger) {
  if (platform === 'darwin') {
    logger.info('Mouting RAMdisk. You may be prompted for credentials');
    return yield *ezspawn(`diskutil erasevolume HFS+ ${darwinName} ${diskPath}`);
  }
  if (platform === 'linux') {
    logger.info('Mouting RAMdisk. You may be prompted for credentials');
    return yield *ezspawn(yield *withSudo(`mount -t tmpfs -o size=${bytes} tmpfs ${linuxRoot}`));
  }

  throw new Error('Unsupported platform!');
});

const mkdir = gensync({
  sync: mkdirSync,
  async: mkdirAsync
});

const BLOCK_SIZE = 512;

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

    const darwinBlocks = bytes / BLOCK_SIZE;

    if (!existsSync(root)) {
      const diskPath = yield *init(darwinBlocks, root, logger);
      yield *mount(bytes, diskPath, name, root, logger);

      logger.info(`RAMdisk is avaliable at ${root}`);
    } else {
      logger.warn(`The path "${root}" already exists, skipping creation`);
    }

    return root;
  }

  if (throwOnNotSupportedPlatform) {
    throw new Error(`Unsupported platform "${platform}"`);
  }

  const root = path.join(tmpdir(), '.mocked-ramdisk', name);

  logger.warn(`The current platform "${platform}" does not support RAMdisks. A temporary directory (which may or may not exists in the RAM) is created at "${root}".`);

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
  throwOnNotSupportedPlatform
}: DestroyOptions = {}) {
  const logger = getLogger(quiet);

  if (platform === 'darwin' || platform === 'linux') {
    const commands = {
      darwin: `hdiutil detach ${root}`,
      linux: yield *withSudo(`umount ${root}`)
    };

    logger.info(`Unmouting RAMdisk at ${root}. You may be prompted for credentials`);

    yield *ezspawn(commands[platform]);

    return;
  }

  if (throwOnNotSupportedPlatform) {
    throw new Error(`Unsupported platform "${platform}"`);
  }

  try {
    yield *rm(root, { recursive: true, force: true });

    logger.warn(`Current platform "${platform}" does not support RAMdisks, attempted to remove the directory "${root}" and successed.`);
  } catch (e) {
    let message = `Current platform "${platform}" does not support RAMdisks, attempted to remove the directory "${root}" but failed`;
    if (typeof e === 'object' && e) {
      if (
        'code' in e
        && typeof e.code === 'string'
      ) {
        message += ' ' + e.code;
      }
      if (
        'message' in e
        && typeof e.message === 'string'
      ) {
        message += ' ' + e.message;
      }
    }

    logger.warn(message);
  }
});
