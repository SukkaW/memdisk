import { Command } from '@commander-js/extra-typings';
import packageJson from '../../package.json';
import { getRootFromName, isInSubDirectory, parseHumanReadableSize } from '../utils';
import { isAbsolute } from 'path';
import { create, destroy } from '..';
import { cwd } from 'process';

(() => {
  const program = (new Command(packageJson.name))
    .version(packageJson.version)
    .description('CLI to create and destroy RAM disks')
    .option('--silent, --quiet', 'Disable messages', false)
    .option('--no-throw-on-not-supported-platform', 'Do not throw an error if the current platform doesn\'t support RAM disks', false)
    .option('--throw-on-not-supported-platform', 'Throw an error if the current platform doesn\'t support RAM disks', true);

  program
    .command('create')
    .description('Create a RAM disk with size and disk name')
    .argument('<size>', 'Size of the RAM disk, accepts number or string with unit (e.g. 16mb, 128m, 1G, 4g, etc.)')
    .argument('[name]', 'Name of the RAM disk, default is "ramdisk"', 'ramdisk')
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
    .description('Destroy a RAM disk with name or path')
    .argument('[nameOrPath]', 'Name or path of the RAM disk (if argument is not an absolute path, it will be treated as a name), default is "ramdisk"', 'ramdisk')
    .action((nameOrPath: string) => {
      const path = isAbsolute(nameOrPath) ? nameOrPath : getRootFromName(nameOrPath);

      if (isInSubDirectory(path, cwd())) {
        throw new Error('Cannot perform destroy as the current working directory is in the RAM disk to be destroyed');
      }

      const { quiet, throwOnNotSupportedPlatform } = program.opts();
      destroy.sync(path, { quiet, throwOnNotSupportedPlatform });
    });

  program
    .showHelpAfterError()
    .showSuggestionAfterError();

  program.parse();
})();
