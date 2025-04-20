import { Server } from "socket.io";
import { socketAuthMiddleware } from "../middleware/auth.js";
import { setupRedis } from "./redis/index.js";
import { setupEventHandlers } from "./events/index.js";
import config from "../config/index.js";

const io = new Server({
  cors: {
    origin: config.API_GATEWAY_URL, // Your gateway URL
    methods: ["GET", "POST"]
  }
});

io.use(socketAuthMiddleware);

// Setup Redis
const { publisher, subscriber, redis } = setupRedis(io);

// Setup event handlers
setupEventHandlers(io, publisher, redis);

export default io;