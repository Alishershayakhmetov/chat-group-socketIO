import { S3Client } from "@aws-sdk/client-s3";
import config from "./config/index.js";

const region = config.BUCKET_REGION
const accessKeyId = config.BUCKET_ACCESS_KEY!
const secretAccessKey = config.BUCKET_SECRET_ACCESS_KEY!

export const s3 = new S3Client({
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey
  },
  region: region,
});
