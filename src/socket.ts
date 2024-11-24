import { Server} from "socket.io";
import { prisma } from "./prismaClient.js"
import { AuthenticatedSocket, roomData } from "./interfaces/interfaces.js";
import { socketAuthMiddleware } from "./middleware/auth.js";
import { Prisma } from "@prisma/client";

const io = new Server({
  cors: {
    origin: process.env.WEBAPP_URL,
    methods: ["GET", "POST"],
    credentials: true
  },
});


io.use(socketAuthMiddleware);

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

    socket.on('search', async (searchInput) => {
      const search = searchInput.query;
      const searchedResult = await prisma.$queryRaw`
      WITH LastMessages AS (
        SELECT
          room_id,
          MAX(created_at) AS last_message_date
        FROM messages
        GROUP BY room_id
      ),
      LastMessagesDetails AS (
        SELECT
          m.room_id,
          m.content AS last_message_content,
          m.created_at AS last_message_date,
          u.name AS last_message_user
        FROM messages m
        JOIN LastMessages lm
          ON m.room_id = lm.room_id AND m.created_at = lm.last_message_date
        JOIN users u
          ON m.user_id = u.id
      )
      SELECT 
        'user' AS type,
        u.id,
        u.name,
        u.last_name,
        similarity(u.name, ${search}) AS name_similarity,
        similarity(u.last_name, ${search}) AS last_name_similarity,
        NULL AS is_public,
        u.img_url AS imgURL,
        NULL AS last_message_content,
        NULL AS last_message_date,
        NULL AS last_message_user
      FROM users u
      WHERE u.name % ${search} OR u.last_name % ${search}
      
      UNION ALL
      
      SELECT 
        'channel' AS type,
        c.id,
        c.name,
        NULL AS last_name,
        similarity(c.name, ${search}) AS name_similarity,
        NULL AS last_name_similarity,
        c.is_public AS is_public,
        c.img_url AS imgURL,
        lmd.last_message_content,
        lmd.last_message_date,
        lmd.last_message_user
      FROM channels c
      LEFT JOIN LastMessagesDetails lmd
        ON c.id = lmd.room_id
      WHERE c.name % ${search} AND c.is_public = true
      
      ORDER BY name_similarity DESC, last_name_similarity DESC;`;

      socket.emit("searchResult", searchedResult);
    })

    
    socket.on('enterChat', async (roomId: string) => {
      // Retrieve last 50 messages from the chat
      try {
        let roomType = roomId.split("-")[0];
        let roomData;
        let count;
        if(roomType === 'chat') {
          roomData = await prisma.chats.findUniqueOrThrow({
            where: {id: roomId}
          })
          roomData = await prisma.usersChats.findFirst({
            where: {
              roomId: roomId,
              NOT: { userId: socket.userId! }, // Exclude the current user
            },
          })
          roomData = roomData ? await prisma.users.findUnique({
            where: {id: roomData.userId}
          }) : null;
          roomType = "chat";
        } else if(roomType === 'group') {
          roomData = await prisma.groups.findUniqueOrThrow({
            where: {id: roomId}
          })
          count = await prisma.usersChats.count({
            where: {roomId: roomData.id}
          })
          roomType = "group";
        } else if (roomType === "channel") {
          roomData = await prisma.channels.findUniqueOrThrow({
            where: {id: roomId}
          })
          count = await prisma.usersChats.count({
            where: {roomId: roomData.id}
          })
          roomType = "channel";
        } else {
          roomData = await prisma.users.findUniqueOrThrow({
            where: {id: roomId}
          })
          roomType = "chat";
        }
        const messages = await prisma.messages.findMany({
          where: { roomId },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        const filteredMessages = messages.map(({ deletedAt, ...rest }) => rest).reverse();
        roomData = roomData as roomData;
        const filteredRoomData = roomData ? {type: roomType, id: roomData.id, name: roomData.name, lastName: roomData.lastName, imgURL: roomData.imgURL, isActive: roomData.status, lastActive: roomData.lastActive, numberOfMembers: count } : null;

        socket.emit('enterChat', [filteredRoomData, filteredMessages]);
      } catch (error) {
        console.error('Error in enterChat:', error);
        socket.emit('error', 'Failed to load chat');
      }
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
      io.in(`${roomId}`).emit('new_message', message);
    });

    // Join the socket to chat-specific rooms
    socket.on('join_chat', (roomId) => {
      socket.join(`${roomId}`);
    });

    socket.on('leave_chat', (roomId) => {
      socket.leave(`${roomId}`);
    });
  } catch (error) {
    console.error('Error:', error);
    socket.disconnect();
  }
});

export default io;