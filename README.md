# memdisk

> A library and a CLI to create RAM disk on macOS and Linux.

## Usage

### As a library

```ts
import { create, destroy } from 'memdisk';

const dir = create.sync(
  'memdisk', // The name of the RAM disk
  1024 * 1024 * 1024, // The size in bytes
  // optional options
  {
    // Supress the output. Default to true
    quiet: true,
    // Throw an error if the platform is not supported.
    // When set to false, a temporary folder (which may or may not be a RAM disk) will be created.
    // Default to true
    throwOnNotSupportedPlatform: true,
    // Use HFS+ instead of APFS on macOS. Default to false
    darwinUseHFSPlus: false,
  }
); // Returns the path to the mounted RAM disk

destroy.sync(
  dir, // The absolute path to the mounted RAM disk
  // optional options
  {
    // Supress the output. Default to true
    quiet: true,
    // Throw an error if the platform is not supported.
    // When set to false, a delete operation will be performed on the path.
    // Default to true
    throwOnNotSupportedPlatform: true,
    // Force unmount the RAM disk. Default to true.
    force: true
  }
);

// Promise based API is also available
const dir = await create.async('memdisk', 1024 * 1024 * 1024);
destroy.async(dir);

// Node.js-style callback (errback) API is also available
create.errback('memdisk', 1024 * 1024 * 1024, (err, dir) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(dir);
  destroy.errback(dir, (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log('Destroyed');
  });
});
```

### As a CLI

```sh
$ memdisk --help

Usage: memdisk [options] [command]

CLI to create and destroy RAM disks

Options:
  -V, --version                      output the version number
  --silent, --quiet                  Disable messages (default: false)
  --throw-on-not-supported-platform  Throw an error if the current platform doesn't support RAM disks (default: true)
  -h, --help                         display help for command

Commands:
  create <size> [name]               Create a RAM disk with size and disk name
  destroy [nameOrPath]               Destroy a RAM disk with name or path
  help [command]                     display help for command
```

```sh
$ memdisk create --help

Usage: memdisk create [options] <size> [name]

Create a RAM disk with size and disk name

Arguments:
  size        Size of the RAM disk, accepts number or string with unit (e.g. 16mb, 32mib, 128m, 1G, 4g, 8gib, etc.)
  name        Name of the RAM disk, default is "ramdisk" (default: "ramdisk")

Options:
  --darwin-use-hfs-plus  Use HFS+ instead of APFS on macOS (default: false)
  -h, --help  display help for command
```

```sh
$ memdisk destroy --help

Usage: memdisk destroy [options] [nameOrPath]

Destroy a RAM disk with name or path

Arguments:
  nameOrPath  Name or path of the RAM disk (if argument is not an absolute path, it will be treated as a name), default is "ramdisk" (default: "ramdisk")

Options:
  --force     Force unmouting and removing the RAM disk (default: false)
  -h, --help  display help for command
```

---

**memdisk** © [Sukka](https://github.com/SukkaW), Released under the [MIT](./LICENSE) License.<br>
Authored and maintained by Sukka with help from contributors ([list](https://github.com/SukkaW/memdisk/graphs/contributors)).

> [Personal Website](https://skk.moe) · [Blog](https://blog.skk.moe) · GitHub [@SukkaW](https://github.com/SukkaW) · Telegram Channel [@SukkaChannel](https://t.me/SukkaChannel) · Mastodon [@sukka@acg.mn](https://acg.mn/@sukka) · Twitter [@isukkaw](https://twitter.com/isukkaw) · Keybase [@sukka](https://keybase.io/sukka)

<p align="center">
  <a href="https://github.com/sponsors/SukkaW/">
    <img src="https://sponsor.cdn.skk.moe/sponsors.svg"/>
  </a>
</p>
