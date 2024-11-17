import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { prisma } from "./prismaClient.js"

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

const io = new Server({
  cors: {
    origin: process.env.WEBAPP_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
});

// Middleware for validating JWT token from cookies
io.use((socket: AuthenticatedSocket, next) => {
  const token = socket.handshake.headers.cookie?.split('; ').find(c => c.startsWith('access_token='))?.split('=')[1];

  if (!token) return next(new Error('Authentication error'));

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, async (err, decoded) => {
    if (err) return next(new Error('Authentication error'));

    // Attach the user ID to the socket
    socket.userId = (decoded as { userId: string }).userId;
    next();
  });
});

io.on('connection', async (socket: AuthenticatedSocket) => {
  try {
    // Retrieve user's chats and last message from each chat
    const chats = await prisma.usersChats.findMany({
      where: { userId: socket.userId },
      include: {
        chat: {
          include: {
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1, // Last message only
            },
          },
        },
      },
    });

    socket.emit('chats', chats);

    // Event for user entering a specific chat
    socket.on('enter_chat', async (roomId) => {
      // Retrieve last 50 messages from the chat
      const messages = await prisma.messages.findMany({
        where: { roomId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      socket.emit('chat_messages', messages.reverse()); // Reverse for chronological order
    });

    // Event for sending a new message
    socket.on('send_message', async ({ roomId, content }) => {
      const message = await prisma.messages.create({
        data: {
          roomId,
          userId: socket.userId!,
          content,
        },
      });

      // Notify all users in the chat about the new message
      io.in(`chat_${roomId}`).emit('new_message', message);
    });

    // Join the socket to chat-specific rooms
    socket.on('join_chat', (roomId) => {
      socket.join(`chat_${roomId}`);
    });

    socket.on('leave_chat', (roomId) => {
      socket.leave(`chat_${roomId}`);
    });
  } catch (error) {
    console.error('Error:', error);
    socket.disconnect();
  }
});

export default io;