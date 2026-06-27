import { Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
// Cast around the duplicate-ioredis type identity (bullmq bundles its own copy of ioredis types).
const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null }) as unknown as ConnectionOptions;

const workers = [
  new Worker("receipt-pdfs", async job => { console.info("Generate receipt PDF", job.data); }, { connection }),
  new Worker("notifications", async job => { console.info("Deliver notification", job.data); }, { connection }),
  new Worker("report-card-pdfs", async job => { console.info("Generate report card PDF", job.data); }, { connection }),
  new Worker("exam-maintenance", async job => { console.info("Maintain exam session", job.data); }, { connection }),
];
for (const worker of workers) worker.on("failed", (job, error) => console.error(`Job ${job?.id} failed`, error));
console.info("Edumod worker is running.");
