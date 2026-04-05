import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import crypto from "crypto";

// S3 is enabled when AWS_S3_BUCKET is set
const bucket = process.env.AWS_S3_BUCKET;
const region = process.env.AWS_S3_REGION || "us-east-1";
const prefix = process.env.AWS_S3_PREFIX || "uploads/";

let s3Client: S3Client | null = null;

export function isS3Enabled(): boolean {
  return !!bucket;
}

function getClient(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region,
      // Credentials are loaded from env (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
      // or from IAM role when running on AWS/Railway
    });
  }
  return s3Client;
}

function s3Key(filename: string): string {
  return `${prefix}${filename}`;
}

/** Upload a file buffer to S3. Returns the filename (not the full key). */
export async function uploadToS3(
  buffer: Buffer,
  originalname: string,
  mimetype: string,
): Promise<string> {
  const ext = path.extname(originalname);
  const filename = crypto.randomUUID() + ext;
  const client = getClient();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket!,
      Key: s3Key(filename),
      Body: buffer,
      ContentType: mimetype,
    }),
  );

  return filename;
}

/** Get a presigned URL for downloading a file from S3 (valid for 1 hour). */
export async function getS3DownloadUrl(filename: string): Promise<string> {
  const client = getClient();
  const command = new GetObjectCommand({
    Bucket: bucket!,
    Key: s3Key(filename),
  });
  return getSignedUrl(client, command, { expiresIn: 3600 });
}

/** Delete a file from S3. */
export async function deleteFromS3(filename: string): Promise<void> {
  const client = getClient();
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket!,
      Key: s3Key(filename),
    }),
  );
}
