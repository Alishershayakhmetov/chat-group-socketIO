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

server.listen(process.env.APP_PORT, () => {
  console.log(`Server listening on port ${process.env.APP_PORT}`);
});