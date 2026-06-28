import { Queue, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
// lazyConnect so importing this module (e.g. from a Server Action) doesn't open a socket at build
// time; the error listener prevents an unhandled 'error' from crashing the process when Redis is down.
const redis = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null, lazyConnect: true });
redis.on("error", (e) => console.error("[redis] connection error:", e.message));
// Cast around the duplicate-ioredis type identity (bullmq bundles its own copy of ioredis types).
const connection = redis as unknown as ConnectionOptions;
export const receiptQueue = new Queue("receipt-pdfs", { connection });
export const notificationQueue = new Queue("notifications", { connection });
export const reportCardQueue = new Queue("report-card-pdfs", { connection });
export const examQueue = new Queue("exam-maintenance", { connection });

// Async upload of the kiosk clock-in selfie to Cloudflare R2 (keeps the Server Action fast).
export const ATTENDANCE_UPLOAD_QUEUE = "attendance-uploads";
export type AttendanceUploadJob = { logId: string; schoolId: string; imageBase64: string };
export const attendanceUploadQueue = new Queue<AttendanceUploadJob>(ATTENDANCE_UPLOAD_QUEUE, { connection });
