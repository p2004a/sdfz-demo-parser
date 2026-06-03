# SpringRTS/RecoilEngine Demo Parser

Parser for SpringRTS/RecoilEngine .sdfz demo files

## Usage

`npm i --save sdfz-demo-parser`

```ts
import { DemoParser } from "sdfz-demo-parser";

(async () => {
    const demoPath = "./example/20201219_003920_Altored Divide Bar Remake 1_104.0.1-1707-gc0fc18e BAR.sdfz";

    const parser = new DemoParser();

    const demo = await parser.parseDemo(demoPath);

    console.log(demo.info.spectators[1].name); // [Fx]Jazcash
})();
```

## CLI

The package also ships a CLI that parses a demo file and prints the result as JSON. You can use it from npm, or download a standalone executable that needs no Node.js installation.

### From npm (requires Node.js 24+)

Run it without installing:

```
npx sdfz-demo-parser <demo.sdfz> [options]
```

Or install it and run the `sdfz-demo-parser` command:

```
npm i -g sdfz-demo-parser
sdfz-demo-parser <demo.sdfz> > demo.json
```

### Standalone executable (no Node.js required)

Every release ships self-contained executables with Node.js bundled in. Download the archive for your platform from the [latest GitHub release](../../releases/latest) (`<version>` is the release version):

| Platform      | Archive                                          |
| ------------- | ------------------------------------------------ |
| Linux x64     | `sdfz-demo-parser-<version>-linux-x64.tar.gz`    |
| Linux arm64   | `sdfz-demo-parser-<version>-linux-arm64.tar.gz`  |
| Windows x64   | `sdfz-demo-parser-<version>-win-x64.zip`         |
| Windows arm64 | `sdfz-demo-parser-<version>-win-arm64.zip`       |

Each archive contains a single `sdfz-demo-parser` (`sdfz-demo-parser.exe` on Windows) binary.

```
# Linux: extract and run
tar -xzf sdfz-demo-parser-*-linux-x64.tar.gz
./sdfz-demo-parser game.sdfz > demo.json

# Windows: unzip, then run
sdfz-demo-parser.exe game.sdfz > demo.json
```

The binaries are unsigned, so Windows SmartScreen may warn on first run. They accept exactly the same options as the npm CLI.

### Examples

```
# Full parse, pretty JSON to stdout (the packet stream is included by default)
sdfz-demo-parser game.sdfz

# Header/summary only (skips the packet stream)
sdfz-demo-parser game.sdfz --header-only

# Only chat and Lua packets, written to a file
sdfz-demo-parser game.sdfz --include-packets CHAT,LUAMSG -o out.json

# Every packet type (clear the default excludes), as compact JSON
sdfz-demo-parser game.sdfz --exclude-packets "" --compact
```

## Development

### Publish new version

```
npm version --sign-git-tag patch|minor|major
git push --follow-tags
```

Pushing the version tag publishes the package to npm and builds the standalone executables, attaching them to the GitHub release for the tag.
