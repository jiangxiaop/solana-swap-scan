pm2 start src/scan/SolanaBlockScanner.ts \
  --interpreter="deno" \
  --interpreter-args="run --allow-net --allow-env --allow-read --allow-ffi --no-check" \
  --name="solana-scanner"
