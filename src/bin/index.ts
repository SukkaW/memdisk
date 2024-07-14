import { cac } from 'cac';
import packageJson from '../../package.json';

(() => {
  const cli = cac('ramdisk-cli');

  // Display help message when `-h` or `--help` appears
  cli.help();
  // Display version number when `-v` or `--version` appears
  // It's also used in help message
  cli.version(packageJson.version);
})();
