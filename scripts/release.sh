#!/usr/bin/env bash
set +x
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

dry_run=false
tag=latest
usage() {
  echo "Usage: npm run release [-- --dry-run] [--tag beta]" >&2
  exit 2
}
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) dry_run=true ;;
    --tag)
      [[ $# -ge 2 ]] || usage
      tag="$2"
      shift ;;
    *) usage ;;
  esac
  shift
done

if [[ ! "$tag" =~ ^[a-z][a-z0-9._-]*$ ]]; then
  usage
fi
version="$(node -p "require('./package.json').version")"
if [[ "$version" == *-* && "$tag" == latest ]]; then
  echo "Prerelease version $version needs a non-latest dist-tag (for example --tag beta)." >&2
  exit 2
fi

if [[ "$dry_run" == false && -z "${NPM_KEY:-}" ]]; then
  echo "NPM_KEY must be exported before publishing." >&2
  exit 1
fi

auth_config=""
cleanup() {
  if [[ -n "$auth_config" ]]; then rm -f "$auth_config"; fi
}
trap cleanup EXIT

if [[ "$dry_run" == false ]]; then
  auth_config="$(mktemp)"
  chmod 600 "$auth_config"
  printf '//registry.npmjs.org/:_authToken=%s\n' "$NPM_KEY" > "$auth_config"
  npm whoami --registry=https://registry.npmjs.org/ --userconfig="$auth_config"
fi

npm run typecheck
npm test
npm run build

mkdir -p release
tarball_name="$(npm pack --pack-destination release --silent)"
tarball="./release/$tarball_name"
if [[ ! -f "$tarball" ]]; then
  echo "npm pack did not create $tarball" >&2
  exit 1
fi
if ! tar -tzf "$tarball" | grep -x 'package/README.md' >/dev/null; then
  echo "Package is missing README.md: $tarball" >&2
  exit 1
fi
if ! tar -tzf "$tarball" | grep -x 'package/assets/dependency-graph-3d.jpg' >/dev/null; then
  echo "Package is missing the README screenshot: $tarball" >&2
  exit 1
fi
echo "Package ready: $tarball"

if [[ "$dry_run" == true ]]; then
  echo "Dry run complete; nothing was published."
  exit 0
fi

publish_args=("$tarball" --registry=https://registry.npmjs.org/ --access=public --tag="$tag" --userconfig="$auth_config")
if [[ -n "${NPM_OTP:-}" ]]; then
  NPM_CONFIG_OTP="$NPM_OTP" npm publish "${publish_args[@]}"
else
  npm publish "${publish_args[@]}"
fi
