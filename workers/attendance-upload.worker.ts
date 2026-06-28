import { Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { teacherAttendanceLogs } from "@/db/schema";
import { r2Client, R2_BUCKET, r2PublicUrl } from "@/lib/r2";
import { ATTENDANCE_UPLOAD_QUEUE, type AttendanceUploadJob } from "@/lib/queues";

// Background worker (run via tsx): `node --env-file=.env --import tsx workers/attendance-upload.worker.ts`
// Uploads the kiosk clock-in selfie to Cloudflare R2 and back-fills the log's snapshotUrl.
const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null }) as unknown as ConnectionOptions;
const s3 = r2Client();

function parseDataUrl(dataUrl: string): { buffer: Buffer; contentType: string; ext: string } {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) throw new Error("Invalid image data URL");
  const contentType = m[1];
  const ext = (contentType.split("/")[1] || "jpg").replace("jpeg", "jpg");
  return { buffer: Buffer.from(m[2], "base64"), contentType, ext };
}

const worker = new Worker<AttendanceUploadJob>(
  ATTENDANCE_UPLOAD_QUEUE,
  async (job) => {
    const { logId, schoolId, imageBase64 } = job.data;
    const { buffer, contentType, ext } = parseDataUrl(imageBase64);
    const key = `attendance/${schoolId}/${logId}.${ext}`;
    await s3.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: buffer, ContentType: contentType }));
    await db.update(teacherAttendanceLogs).set({ snapshotUrl: r2PublicUrl(key), updatedAt: new Date() }).where(eq(teacherAttendanceLogs.id, logId));
    return { key };
  },
  { connection, concurrency: 4 },
);

worker.on("completed", (job) => console.info(`[attendance] snapshot stored for log ${job.data.logId}`));
worker.on("failed", (job, err) => console.error(`[attendance] upload failed for log ${job?.data.logId}:`, err.message));
console.info("Attendance upload worker is running.");
