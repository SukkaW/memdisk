import { existsSync, unlinkSync, mkdirSync } from 'fs';
import { mkdir as mkdirAsync, unlink as unlinkAsync } from 'fs/promises';

import whichAsync, { sync as whichSync } from 'which';
import path from 'path';

import { sync as ezspawnSync, async as ezspawnAsync } from '@jsdevtools/ez-spawn';
import type ezSpawn from '@jsdevtools/ez-spawn';

import { platform } from 'process';
import { tmpdir } from 'os';
import gensync from 'gensync';

let whichSudo: string | undefined | null;
const which = gensync({
  sync: whichSync,
  async: whichAsync
});

const withSudo = gensync(function *(originalCommand: string) {
  if (whichSudo === undefined) {
    whichSudo = yield *which('sudo', { nothrow: true });
  }
  if (whichSudo === null) {
    return originalCommand;
  }
  return whichSudo + ' ' + originalCommand;
});

const ezspawn = gensync<[string], ezSpawn.Process>({
  sync: ezspawnSync,
  async: ezspawnAsync
});

const init = gensync(function *(darwinBlocks: number, linuxRoot: string) {
  if (platform === 'darwin' || platform === 'linux') {
    const commands = {
      darwin: `hdiutil attach -nomount ram://${darwinBlocks}`,
      linux: yield *withSudo(`mkdir -p ${linuxRoot}`)
    };
    // console.info(pc.blue('swc3 ramdisk:'), 'Initializing RAMdisk. You may be prompted for credentials');
    const diskPath = (yield *ezspawn(commands[platform])).stdout;
    return diskPath.trim();
  }

  throw new Error('Unsupported platform!');
});

const mount = gensync(function *(bytes: number, diskPath: string, darwinName: string, linuxRoot: string) {
  if (platform === 'darwin') {
    // console.info(pc.blue('swc3 ramdisk:'), `Mouting RAMdisk at ${diskPath}. You may be prompted for credentials`);
    return yield *ezspawn(`diskutil erasevolume HFS+ ${darwinName} ${diskPath}`);
  }
  if (platform === 'linux') {
    // console.info(pc.blue('swc3 ramdisk:'), `Mouting RAMdisk at ${root}. You may be prompted for credentials`);
    return yield *ezspawn(yield *withSudo(`mount -t tmpfs -o size=${bytes} tmpfs ${linuxRoot}`));
  }

  throw new Error('Unsupported platform!');
});

const mkdir = gensync({
  sync: mkdirSync,
  async: mkdirAsync
});

export const create = gensync(function *(name: string, bytes?: number | undefined /** 128 MiB */, blockSize?: number | undefined) {
  if (platform === 'darwin' || platform === 'linux') {
    const root = platform === 'darwin' ? `/Volumes/${name}` : `/mnt/${name}`;

    // TODO: move to default parameters once https://github.com/microsoft/TypeScript/issues/59643 is fixed
    bytes ??= 1.28e8;
    blockSize ??= 512;

    const blocks = bytes / blockSize;

    if (!existsSync(root)) {
      const diskPath = yield *init(blocks, root);
      yield *mount(bytes, diskPath, name, root);
    }

    // console.info(pc.green('swc3 ramdisk:'), `RAMdisk is avaliable at ${root}.`);
    return root;
  }

  // console.info(pc.red('swc3 ramdisk:'), 'The current platform does not support RAMdisks. Using a temporary directory instead.');

  const root = path.join(tmpdir(), '.fake-ramdisk', name);
  yield *mkdir(root, { recursive: true });

  return root;
});

const unlink = gensync({
  sync: unlinkSync,
  async: unlinkAsync
});

export const destroy = gensync(function *(root: string) {
  if (platform === 'darwin' || platform === 'linux') {
    const commands = {
      darwin: `hdiutil detach ${root}`,
      linux: yield *withSudo(`umount ${root}`)
    };

    // console.info(pc.yellow('swc3 ramdisk:'), `Unmouting RAMdisk at ${root}. You may be prompted for credentials`);
    return yield *ezspawn(commands[platform]);
  }

  return yield *unlink(root);
});
