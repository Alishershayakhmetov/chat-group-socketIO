import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middleware/auth.js";
import { setupRedis } from "./redis/index.js";
import { setupEventHandlers } from "./events/index.js";

const io = new Server({
  cors: {
    origin: process.env.WEBAPP_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
});

io.use(socketAuthMiddleware);

// Setup Redis
const { publisher, subscriber, redis } = setupRedis(io);

// Setup event handlers
setupEventHandlers(io, publisher, redis);

export default io;