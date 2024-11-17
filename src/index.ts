import express, {Request, Response} from "express";
import http from "http";
import socketServer from "./socket.js";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: process.env.WEBAPP_URL,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

const server = http.createServer(app);
socketServer.attach(server);

app.get('/', (req: Request, res: Response) => {
  res.send('Chat app running...');
});

server.listen(process.env.APP_PORT, () => {
  console.log(`Server listening on port ${process.env.APP_PORT}`);
});