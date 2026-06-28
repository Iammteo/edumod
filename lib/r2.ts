import { S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 is S3-compatible. Configure via env:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL (optional CDN)
export const R2_BUCKET = process.env.R2_BUCKET ?? "edumod";
export const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL ?? "";

export function r2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  return new S3Client({
    region: "auto",
    endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    },
  });
}

// Public URL for a stored object key (CDN base if set, else the key for signed-URL resolution).
export const r2PublicUrl = (key: string) => (R2_PUBLIC_BASE_URL ? `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}` : key);
