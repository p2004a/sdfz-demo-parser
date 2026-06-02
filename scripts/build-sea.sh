#!/usr/bin/env bash
# Build self-contained single executable applications (SEA) of the CLI.
#
# Usage:
#   scripts/build-sea.sh                  Build every target (linux/windows, x64/arm64)
#   scripts/build-sea.sh --all            Same as above
#   scripts/build-sea.sh win-x64 linux-arm64   Build the named target(s)
#
# Outputs go to dist-bin/sdfz-demo-parser-<target>[.exe].
#
# Run with the Node you want to ship (26+): `node --build-sea` requires Node >= 25.5
# and the embedded runtime is whatever Node runs this, which must match the
# downloaded target binaries (handled automatically below).
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_VERSION="$(node -p 'process.versions.node')"
PKG_VERSION="$(node -p 'require("./package.json").version')"

mkdir -p build dist-bin nodes

# Bundle the CLI + its deps into one CommonJS file (SEA needs a single file).
npx esbuild src/cli.ts --bundle --platform=node --format=cjs --target=node26 \
  --outfile=build/cli.cjs "--define:__SEA_VERSION__=\"$PKG_VERSION\""

build_one() {
  local target="$1" archive bin ext name nodebin out
  case "$target" in
    win-*) archive=zip;    bin=node.exe; ext=.exe ;;
    *)     archive=tar.gz; bin=bin/node; ext= ;;
  esac
  name="node-v$NODE_VERSION-$target"
  nodebin="nodes/$name/$bin"
  if [[ ! -f "$nodebin" ]]; then
    echo "Downloading $name.$archive"
    curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/$name.$archive" -o "nodes/$name.$archive"
    if [[ "$archive" == zip ]]; then
      unzip -qo "nodes/$name.$archive" -d nodes
    else
      tar -xzf "nodes/$name.$archive" -C nodes
    fi
  fi
  out="dist-bin/sdfz-demo-parser-$target$ext"
  # useCodeCache/useSnapshot must stay false for cross-platform blobs.
  cat > build/sea-config.json <<EOF
{ "main": "build/cli.cjs", "output": "$out", "executable": "$nodebin",
  "disableExperimentalSEAWarning": true, "useCodeCache": false, "useSnapshot": false }
EOF
  node --build-sea build/sea-config.json
  echo "Built $out"
}

targets=("$@")
if [[ ${#targets[@]} -eq 0 || "${targets[0]}" == "--all" ]]; then
  targets=(linux-x64 linux-arm64 win-x64 win-arm64)
fi
for target in "${targets[@]}"; do
  build_one "$target"
done
