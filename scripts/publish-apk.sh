#!/usr/bin/env bash
# Publishes a direct-download APK to MinIO: a versioned copy, gebeta-maps.apk
# (always the newest build) and latest.json, which the in-app updater polls.
set -euo pipefail

apk="$1"
: "${APP_VERSION:?}" "${APP_BUILD_VERSION:?}" "${MINIO_ACCESS_KEY:?}" "${MINIO_SECRET_KEY:?}"

endpoint="${MINIO_ENDPOINT:-https://minio.traffic.gebeta.app}"
dir="traffic-app-public/releases/android"
name="gebeta-maps-$APP_VERSION-$APP_BUILD_VERSION.apk"
mime="Content-Type=application/vnd.android.package-archive"

curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /tmp/mc
chmod +x /tmp/mc
/tmp/mc alias set store "$endpoint" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY" >/dev/null

node -e '
  const fs = require("fs");
  const crypto = require("crypto");
  const [file, url] = process.argv.slice(1);
  console.log(JSON.stringify({
    versionName: process.env.APP_VERSION,
    versionCode: Number(process.env.APP_BUILD_VERSION),
    url,
    sizeBytes: fs.statSync(file).size,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
    minVersionCode: Number(process.env.APK_MIN_VERSION_CODE || 0),
    publishedAt: new Date().toISOString(),
  }, null, 2));
' "$apk" "$endpoint/$dir/$name" > /tmp/latest.json

# Manifest goes last so it never points at an APK that isn't there yet.
/tmp/mc cp --attr "$mime" "$apk" "store/$dir/$name"
/tmp/mc cp --attr "$mime;Cache-Control=no-cache" "$apk" "store/$dir/gebeta-maps.apk"
/tmp/mc cp --attr "Content-Type=application/json;Cache-Control=no-cache" /tmp/latest.json "store/$dir/latest.json"

cat /tmp/latest.json
