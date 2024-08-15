import { program } from 'commander';
import packageJson from '../../package.json';
import { getRootFromName, isInSubDirectory, parseHumanReadableSize } from '../utils';
import { isAbsolute } from 'path';
import { create, destroy } from '..';
import { cwd } from 'process';

(() => {
  program
    .name(packageJson.name)
    .version(packageJson.version)
    .description('CLI to create and destroy ramdisks')
    .option('--silent, --quiet', 'Disable messages', false)
    .option('--throw-on-not-supported-platform', 'Throw an error if the current platform doesn\'t support ramdisks', true);

  program
    .command('create')
    .description('Create a ramdisk with size and disk name')
    .argument('<size>', 'Size of the ramdisk, accepts number or string with unit (e.g. 16mb, 128m, 1G, 4g, etc.)')
    .argument('[name]', 'Name of the ramdisk, default is "ramdisk"', 'ramdisk')
    .action((inputSize: string, name: string) => {
      const size = parseHumanReadableSize(inputSize);

      if (isAbsolute(name)) {
        throw new TypeError('[name] must not be a path');
      }

      const { quiet, throwOnNotSupportedPlatform } = program.opts();
      create.sync(name, size, { quiet, throwOnNotSupportedPlatform });
    });

  program
    .command('destroy')
    .description('Destroy a ramdisk with name or path')
    .argument('[nameOrPath]', 'Name or path of the ramdisk (if argument is not an absolute path, it will be treated as a name), default is "ramdisk"', 'ramdisk')
    .action((nameOrPath: string) => {
      const path = isAbsolute(nameOrPath) ? nameOrPath : getRootFromName(nameOrPath);

      if (isInSubDirectory(path, cwd())) {
        throw new Error('Cannot destroy the ramdisk because the current working directory is in the ramdisk');
      }

      const { quiet, throwOnNotSupportedPlatform } = program.opts();
      destroy.sync(path, { quiet, throwOnNotSupportedPlatform });
    });

  program
    .showHelpAfterError()
    .showSuggestionAfterError();

  program.parse();
})();
