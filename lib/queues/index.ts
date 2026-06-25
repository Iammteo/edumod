import { Queue } from "bullmq";
import IORedis from "ioredis";
const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });
export const receiptQueue = new Queue("receipt-pdfs", { connection });
export const notificationQueue = new Queue("notifications", { connection });
export const reportCardQueue = new Queue("report-card-pdfs", { connection });
export const examQueue = new Queue("exam-maintenance", { connection });
