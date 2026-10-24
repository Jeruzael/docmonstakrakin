#!/bin/sh
# Disposable qualification only. No installation or original workspace inputs.
# Run explicitly as root: sh this-file NODE_EXECUTABLE NODE_MODULES USER [STRACE]
set -eu
if [ "${1-}" != "--private-namespace" ]; then
  [ "$(id -u)" = 0 ] || { echo "Requires an explicitly authorized root fixture process" >&2; exit 2; }
  [ "$#" -ge 3 ] && [ "$#" -le 4 ] || { echo "Usage: script NODE_EXECUTABLE NODE_MODULES USER [STRACE]" >&2; exit 2; }
  capacity_parent_namespace=$(readlink /proc/self/ns/mnt)
  exec unshare --mount --propagation private sh "$0" --private-namespace "$capacity_parent_namespace" "$@"
fi
shift
capacity_parent_namespace=$1
shift
[ "$(readlink /proc/self/ns/mnt)" != "$capacity_parent_namespace" ] || { echo "Private mount namespace required" >&2; exit 2; }
capacity_node=$1
capacity_modules=$2
capacity_user=$3
capacity_strace=${4-}
[ -x "$capacity_node" ] && [ -d "$capacity_modules/better-sqlite3" ] || exit 2
[ "$(id -u "$capacity_user")" != 0 ] || { echo "Fixture observer must be unprivileged" >&2; exit 2; }
capacity_repo=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
capacity_run=$(mktemp -d /tmp/dmk-capacity-qualification.XXXXXX)
chmod 755 "$capacity_run"
mkdir -p "$capacity_run/code/server/security/workspaceAccess" "$capacity_run/code/scripts/fixtures" "$capacity_run/traces"
for capacity_name in capacityImage.cjs capacityInspectorWorker.cjs projectPolicy.cjs worker.cjs; do
  cp "$capacity_repo/server/security/workspaceAccess/$capacity_name" "$capacity_run/code/server/security/workspaceAccess/"
done
for capacity_name in capacityInspectorSynthetic.cjs capacityInspectorNoWriteGuard.cjs capacityInspectorCancelProbe.cjs capacityInspectorReadonlyQualification.cjs; do
  cp "$capacity_repo/scripts/fixtures/$capacity_name" "$capacity_run/code/scripts/fixtures/"
done
chown "$capacity_user" "$capacity_run/traces"
capacity_worker="$capacity_run/code/server/security/workspaceAccess/capacityInspectorWorker.cjs"
capacity_script="$capacity_run/code/scripts/fixtures/capacityInspectorReadonlyQualification.cjs"
truncate -s 32M "$capacity_run/image.ext4"
chmod 600 "$capacity_run/image.ext4"
mkfs.ext4 -q "$capacity_run/image.ext4"
mkdir "$capacity_run/mount" "$capacity_run/bind"
mount -o loop,nosuid,nodev,noexec "$capacity_run/image.ext4" "$capacity_run/mount"
capacity_bind_mounted=no
trap 'if [ "$capacity_bind_mounted" = yes ]; then umount "$capacity_run/bind"; fi; umount "$capacity_run/mount"' EXIT
chown "$capacity_user" "$capacity_run/mount"
chmod 700 "$capacity_run/mount"
runuser -u "$capacity_user" -- env NODE_PATH="$capacity_modules" "$capacity_node" "$capacity_script" prepare "$capacity_run/mount/fixture"
mount --bind "$capacity_run/mount" "$capacity_run/bind"
capacity_bind_mounted=yes
mount -o remount,bind,ro "$capacity_run/bind"
runuser -u "$capacity_user" -- env NODE_PATH="$capacity_modules" "$capacity_node" -e 'const assert=require("node:assert/strict"),fs=require("node:fs"),p=process.argv[2]+"/.security/authority.sqlite",before=fs.statSync(p,{bigint:true});const r=require(process.argv[1]).inspectWorkspaceCapacityOffline(process.argv[2]);assert.equal(r.reason,"CAPACITY_IMMUTABLE_SOURCE_REQUIRED");assert.deepEqual(fs.statSync(p,{bigint:true}),before);console.log("PASS RO bind over writable superblock refused before source read");' "$capacity_worker" "$capacity_run/bind/fixture/audit4096"
umount "$capacity_run/bind"
capacity_bind_mounted=no
mount -o remount,ro "$capacity_run/mount"
if [ -n "$capacity_strace" ]; then
  [ -x "$capacity_strace" ] || exit 2
  runuser -u "$capacity_user" -- env NODE_PATH="$capacity_modules" CAPACITY_STRACE="$capacity_strace" CAPACITY_TRACE_DIRECTORY="$capacity_run/traces" "$capacity_node" "$capacity_script" verify "$capacity_run/mount/fixture"
else
  runuser -u "$capacity_user" -- env NODE_PATH="$capacity_modules" "$capacity_node" "$capacity_script" verify "$capacity_run/mount/fixture"
fi
echo "Synthetic fixture and optional traces retained at $capacity_run; mounts detach on exit."
