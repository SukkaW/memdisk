import whichAsync, { sync as whichSync } from 'which';
import gensync from 'gensync';
import { platform, cwd, chdir } from 'process';
import { statSync } from 'fs';
import { isAbsolute, relative } from 'path';

let whichSudo: string | undefined | null;
const which = gensync({
  sync: whichSync,
  async: whichAsync
});

export const withSudo = gensync(function *(originalCommand: string) {
  if (whichSudo === undefined) {
    whichSudo = yield *which('sudo', { nothrow: true });
  }
  if (whichSudo === null) {
    return originalCommand;
  }
  return whichSudo + ' ' + originalCommand;
});

export const getRootFromName = (name: string) => {
  return platform === 'darwin' ? `/Volumes/${name}` : `/mnt/${name}`;
};

export const cd = (dir: string) => {
  try {
    const curDir = cwd();
    chdir(dir);
    process.env.OLDPWD = curDir;
    return '';
  } catch {
    // something went wrong, let's figure out the error
    let err;
    try {
      statSync(dir); // if this succeeds, it must be some sort of file
      err = 'Failed to cd, not a directory: ' + dir;
    } catch {
      err = 'Failed to cd, no such file or directory: ' + dir;
    }

    return err;
  }
};

const rPureNumber = /^\d+$/;
const rParse = /(\d+)\s*?([A-Za-z]+)/;
export const parseHumanReadableSize = (input: string) => {
  if (rPureNumber.test(input)) {
    return Number.parseInt(input, 10);
  }

  const matches = input.match(rParse);
  if (!matches || matches.length < 2) {
    throw new TypeError('Invalid size: ' + input);
  }

  const num = Number.parseInt(matches[1], 10);
  if (Number.isNaN(num)) {
    throw new TypeError('Invalid size: ' + input);
  }

  let unit = matches[2].toLowerCase();
  if (unit.endsWith('s')) {
    unit = unit.slice(0, -1);
  }

  switch (unit) {
    case 'b':
    case 'byte':
      return num;
    case 'k':
    case 'kib':
      return num * 1024;
    case 'kb':
      return num * 1000;
    case 'm':
    case 'mib':
      return num * 1024 * 1024;
    case 'mb':
      return num * 1000 * 1000;
    case 'g':
    case 'gib':
      return num * 1024 * 1024 * 1024;
    case 'gb':
      return num * 1000 * 1000 * 1000;
    case 't':
    case 'tib':
      return num * 1024 * 1024 * 1024 * 1024;
    case 'tb':
      return num * 1000 * 1000 * 1000 * 1000;
    default:
      throw new TypeError('Not supported unit: ' + unit);
  }
};

export const isInSubDirectory = (parent: string, child: string) => {
  const relativePath = relative(parent, child);
  return relativePath.length > 0 && !relativePath.startsWith('..') && !isAbsolute(relativePath);
};
