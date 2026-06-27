import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
// Cast around the duplicate-ioredis type identity (bullmq bundles its own copy of ioredis types).
const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null }) as unknown as ConnectionOptions;
export const receiptQueue = new Queue("receipt-pdfs", { connection });
export const notificationQueue = new Queue("notifications", { connection });
export const reportCardQueue = new Queue("report-card-pdfs", { connection });
export const examQueue = new Queue("exam-maintenance", { connection });
