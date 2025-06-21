pm2 start src/cron/snapshot/index.ts \
  --interpreter="deno" \
  --interpreter-args="run --allow-net --allow-env --allow-read --allow-ffi --no-check" \
  --name="data-snapshot"
