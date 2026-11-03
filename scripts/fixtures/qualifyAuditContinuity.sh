#!/bin/sh
# SYNTHETIC ONLY. Explicit root launcher; unprivileged engine; private mount namespace.
set -eu
if [ "${1-}" != --private-namespace ]; then
  [ "$(id -u)" = 0 ] && [ "$#" = 3 ] || exit 2
  continuity_namespace=$(readlink /proc/self/ns/mnt)
  exec unshare --mount --propagation private sh "$0" --private-namespace "$continuity_namespace" "$@"
fi
shift
continuity_namespace=$1
shift
[ "$(readlink /proc/self/ns/mnt)" != "$continuity_namespace" ] || exit 2
continuity_node=$1
continuity_modules=$2
continuity_user=$3
[ -x "$continuity_node" ] && [ -d "$continuity_modules/better-sqlite3" ] && [ "$(id -u "$continuity_user")" != 0 ] || exit 2
continuity_repo=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
continuity_run=$(mktemp -d /tmp/dmk-continuity-qualification.XXXXXX)
chmod 755 "$continuity_run"
mkdir -p "$continuity_run/code/server/security/workspaceAccess/continuity" "$continuity_run/code/scripts/fixtures"
cp "$continuity_repo"/server/security/workspaceAccess/continuity/*.cjs "$continuity_run/code/server/security/workspaceAccess/continuity/"
for continuity_name in capacityImage.cjs capacityInspectorWorker.cjs projectPolicy.cjs worker.cjs; do cp "$continuity_repo/server/security/workspaceAccess/$continuity_name" "$continuity_run/code/server/security/workspaceAccess/"; done
for continuity_name in capacityInspectorSynthetic.cjs auditContinuitySynthetic.cjs auditContinuityQualification.cjs auditContinuityFaultProbe.cjs; do cp "$continuity_repo/scripts/fixtures/$continuity_name" "$continuity_run/code/scripts/fixtures/"; done
truncate -s 64M "$continuity_run/source.ext4"
truncate -s 1G "$continuity_run/output.ext4"
chmod 600 "$continuity_run/source.ext4" "$continuity_run/output.ext4"
mkfs.ext4 -q "$continuity_run/source.ext4"
mkfs.ext4 -q "$continuity_run/output.ext4"
mkdir "$continuity_run/source" "$continuity_run/output"
mount -o loop,nosuid,nodev,noexec "$continuity_run/source.ext4" "$continuity_run/source"
trap 'umount "$continuity_run/source"' EXIT
mount -o loop,nosuid,nodev,noexec "$continuity_run/output.ext4" "$continuity_run/output"
trap 'umount "$continuity_run/output"; umount "$continuity_run/source"' EXIT
chown "$continuity_user" "$continuity_run/source" "$continuity_run/output"
chmod 700 "$continuity_run/source" "$continuity_run/output"
continuity_script="$continuity_run/code/scripts/fixtures/auditContinuityQualification.cjs"
runuser -u "$continuity_user" -- env NODE_PATH="$continuity_modules" "$continuity_node" "$continuity_script" prepare "$continuity_run/source/fixture" "$continuity_run/output"
mount -o remount,ro "$continuity_run/source"
runuser -u "$continuity_user" -- env NODE_PATH="$continuity_modules" "$continuity_node" "$continuity_script" verify "$continuity_run/source/fixture" "$continuity_run/output"
echo "Synthetic fixture retained at $continuity_run; namespace mounts detach on exit."
