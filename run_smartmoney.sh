pm2 start src/cron/snapshot/index.ts \
  --interpreter="deno" \
  --interpreter-args="run --allow-all src/cron/smart-money/index.ts --start-scheduler" \
  --name="smart-money"
