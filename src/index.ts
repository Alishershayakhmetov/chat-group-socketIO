import express, {Request, Response} from "express";
import { createServer } from "http";
import socketServer from "./socket/server.js";
import cors from "cors";
import { s3 } from "./S3Client.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from 'crypto';
import { promisify } from "util";

const randomBytes = promisify(crypto.randomBytes);

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.WEBAPP_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

const server = createServer(app);
socketServer.attach(server);

app.get('/', (req: Request, res: Response) => {
  res.send('Chat app running...');
});

async function generateUploadURLs(extensions: string[]): Promise<{url: string, key: string}[]> {
  const signedUrls: {url: string, key: string}[] = [];

  for (const extension of extensions) {
    const rawBytes = await randomBytes(16);
    const fileName = rawBytes.toString('hex') + "." + extension;

    const params = {
      Bucket: process.env.BUCKET_NAME1,
      Key: fileName,
      Expires: 60,
    };

    const command = new PutObjectCommand({
      Bucket: params.Bucket,
      Key: params.Key,
    });

    const uploadURL = await getSignedUrl(s3, command, { expiresIn: params.Expires });
    signedUrls.push({url: uploadURL, key: fileName});
  }

  return signedUrls;
}

app.post('/upload', async (req: Request, res: Response) => {
  let { extensions } = req.body;

  // Ensure extensions is always an array of strings
  if (typeof extensions === 'string') {
    extensions = [extensions];
  } else if (!Array.isArray(extensions) || !extensions.every(ext => typeof ext === 'string')) {
    res.status(400).json({ error: 'Invalid extensions format' });
    return;
  }

  const urls = await generateUploadURLs(extensions);
  res.json({ urls });
});


server.listen(process.env.APP_PORT, () => {
  console.log(`Server listening on port ${process.env.APP_PORT}`);
});