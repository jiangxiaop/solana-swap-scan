import { SnapshotScheduler } from "./index.ts";

Deno.test("test snapshot", async () => {
    const snapshotScheduler = new SnapshotScheduler();
    await snapshotScheduler.start().catch((error) => {
        console.error("Snapshot scheduler failed to start:", error);
        Deno.exit(1);
    });

    await snapshotScheduler.stop();
});