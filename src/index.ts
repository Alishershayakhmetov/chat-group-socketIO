import express, {Request, Response} from "express";
import { createServer } from "http";
import socketServer from "./socket/server.js";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3005;
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

app.get('/health', (req: Request, res: Response) => {
  res.status(200).send("OK");
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});