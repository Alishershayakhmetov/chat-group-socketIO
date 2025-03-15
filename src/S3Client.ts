import { S3Client } from "@aws-sdk/client-s3";

const region = process.env.BUCKET_REGION1
const accessKeyId = process.env.BUCKET_ACCESS_KEY1!
const secretAccessKey = process.env.BUCKET_SECRET_ACCESS_KEY1!

export const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey
  },
  region: region,
});
