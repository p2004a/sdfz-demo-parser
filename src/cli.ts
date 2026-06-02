#!/usr/bin/env node
import { readFileSync, writeFileSync } from "fs";
import * as path from "path";
import { parseArgs } from "util";

import { DemoModel, DemoParser, DemoParserConfig } from "./index";

if (typeof parseArgs !== "function") {
    process.stderr.write("sdfz-demo-parser CLI requires Node.js 18.3+ (Node 24+ recommended).\n");
    process.exit(1);
}

const USAGE = `Usage: sdfz-demo-parser <demo.sdfz> [options]

Parse a Recoil/SpringRTS .sdfz demo file and print the result as JSON to stdout.

Options:
  --header-only                  Parse only the header/summary (skips the packet stream)
  --include-packets <list>       Only include these packet types (names or numeric ids)
  --exclude-packets <list>       Exclude these packet types (replaces the default excludes)
  --include-player-ids <list>    Only include packets/commands from these player ids
  --exclude-lua-handlers <list>  Lua handler names to exclude from the packet stream
  --no-standard-lua-handlers     Disable the built-in standard Lua data handlers
  -v, --verbose                  Print parser diagnostics to stderr
  -o, --output <file>            Write JSON to <file> instead of stdout
  --compact                      Emit compact (single-line) JSON instead of pretty-printed
  -h, --help                     Show this help
  --version                      Print the package version

Lists are comma-separated and/or the flag may be repeated, e.g.
  --include-packets CHAT,LUAMSG --include-packets STARTPOS
A list flag overrides its library default whenever given; pass an empty value
(e.g. --exclude-packets "") to clear that filter entirely.

By default the packet stream is included, respecting the include/exclude filters.
Packets excluded by default: NEWFRAME, KEYFRAME, SYNCRESPONSE, PLAYERINFO
(pass --exclude-packets "" to include them as well).
Requires Node.js 18.3+ (Node 24+ recommended).
`;

function parseArgsOrExit() {
    try {
        return parseArgs({
            allowPositionals: true,
            options: {
                "header-only": { type: "boolean" },
                "include-packets": { type: "string", multiple: true },
                "exclude-packets": { type: "string", multiple: true },
                "include-player-ids": { type: "string", multiple: true },
                "exclude-lua-handlers": { type: "string", multiple: true },
                "no-standard-lua-handlers": { type: "boolean" },
                "verbose": { type: "boolean", short: "v" },
                "output": { type: "string", short: "o" },
                "compact": { type: "boolean" },
                "help": { type: "boolean", short: "h" },
                "version": { type: "boolean" },
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`Error: ${message}\n\n${USAGE}`);
        return process.exit(1);
    }
}

function splitList(values?: string[]): string[] {
    if (values === undefined) {
        return [];
    }
    return values
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
}

function resolvePacketId(token: string): DemoModel.Packet.ID {
    const name = token.trim();
    if (/^\d+$/.test(name)) {
        const id = Number(name);
        if (DemoModel.Packet.ID[id] === undefined) {
            throw new Error(`Unknown packet id: ${name}`);
        }
        return id as DemoModel.Packet.ID;
    }
    const lookup = DemoModel.Packet.ID as unknown as Record<string, number | undefined>;
    const id = lookup[name.toUpperCase()];
    if (typeof id !== "number") {
        throw new Error(`Unknown packet name: ${name}`);
    }
    return id as DemoModel.Packet.ID;
}

function toPlayerId(token: string): number {
    const id = Number(token.trim());
    if (!Number.isInteger(id)) {
        throw new Error(`Invalid player id: ${token}`);
    }
    return id;
}

function jsonReplacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
    const raw = this[key];
    if (Buffer.isBuffer(raw)) {
        return raw.toString("base64");
    }
    if (typeof raw === "bigint") {
        return raw.toString();
    }
    return value;
}

function getVersion(): string {
    const pkg = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8")) as { version: string };
    return pkg.version;
}

type CliValues = ReturnType<typeof parseArgsOrExit>["values"];

function buildConfig(values: CliValues): DemoParserConfig {
    const config: DemoParserConfig = {};
    if (values["header-only"]) {
        config.skipPackets = true;
    }
    if (values.verbose) {
        config.verbose = true;
    }
    if (values["no-standard-lua-handlers"]) {
        config.includeStandardLuaHandlers = false;
    }

    // A list flag overrides its library default whenever it is present, even when
    // empty -- so e.g. `--exclude-packets ""` clears the default packet excludes.
    if (values["include-packets"] !== undefined) {
        config.includePackets = splitList(values["include-packets"]).map(resolvePacketId);
    }
    if (values["exclude-packets"] !== undefined) {
        config.excludePackets = splitList(values["exclude-packets"]).map(resolvePacketId);
    }
    if (values["include-player-ids"] !== undefined) {
        config.includePlayerIds = splitList(values["include-player-ids"]).map(toPlayerId);
    }
    if (values["exclude-lua-handlers"] !== undefined) {
        config.excludeLuaHandlers = splitList(values["exclude-lua-handlers"]);
    }

    return config;
}

async function main(): Promise<void> {
    const { values, positionals } = parseArgsOrExit();

    if (values.help) {
        process.stdout.write(USAGE);
        return;
    }
    if (values.version) {
        process.stdout.write(`${getVersion()}\n`);
        return;
    }
    if (positionals.length !== 1) {
        const problem = positionals.length === 0 ? "missing demo file path" : "expected exactly one demo file path";
        process.stderr.write(`Error: ${problem}.\n\n${USAGE}`);
        process.exit(1);
    }
    const file = positionals[0];
    const config = buildConfig(values);

    const parser = new DemoParser(config);
    const packets: DemoModel.Packet.AbstractPacket[] = [];
    if (!config.skipPackets) {
        parser.onPacket.add((packet) => {
            packets.push(packet);
        });
    }

    const demo = await parser.parseDemo(file);
    const result = config.skipPackets ? demo : { ...demo, packets };

    const json = JSON.stringify(result, jsonReplacer, values.compact ? 0 : 2);
    if (values.output !== undefined) {
        writeFileSync(values.output, json);
    } else {
        process.stdout.write(`${json}\n`);
    }
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
});
