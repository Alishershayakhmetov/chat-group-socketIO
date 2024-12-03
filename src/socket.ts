import { Server} from "socket.io";
import { prisma } from "./prismaClient.js"
import { AuthenticatedSocket, UserRoomsList, roomData } from "./interfaces/interfaces.js";
import { socketAuthMiddleware } from "./middleware/auth.js";
import { s3 } from "./S3Client.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createNewChat, getUserRoomsList } from "./helper/socketFunctions.js";

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
    const userRooms = await getUserRoomsList(socket.userId!);
    console.log("user rooms:", userRooms);
    socket.emit('chats', userRooms);

    socket.on('search', async (searchInput) => {
      const search = searchInput.query;
      const searchedResult = await prisma.$queryRaw`
      WITH LastMessages AS (
				SELECT
					channel_room_id,
				  chat_room_id,
				  MAX(created_at) AS last_message_date
				FROM messages
				GROUP BY channel_room_id, chat_room_id
			  ),
			  LastMessagesDetails AS (
				SELECT
					m.channel_room_id,
				  m.chat_room_id,
				  m.text AS last_message_content,
				  m.created_at AS last_message_date,
				  u.name AS last_message_user
				FROM messages m
				JOIN LastMessages lm
				  ON m.channel_room_id = lm.channel_room_id AND m.chat_room_id = lm.chat_room_id AND m.created_at = lm.last_message_date
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
				ON c.id = lmd.channel_room_id
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
        if(roomType === 'group') {
          roomData = await prisma.groups.findUniqueOrThrow({
            where: {id: roomId}
          })
          count = await prisma.usersRooms.count({
            where: {groupRoomId: roomData.id}
          })
          roomType = "group";
        } else if (roomType === "channel") {
          roomData = await prisma.channels.findUniqueOrThrow({
            where: {id: roomId}
          })
          count = await prisma.usersRooms.count({
            where: {channelRoomId: roomData.id}
          })
          roomType = "channel";
        } else {
          roomData = await prisma.users.findUniqueOrThrow({
            where: {id: roomId}
          })
          roomType = "chat";
        }
        const messages = await prisma.messages.findMany({
          where: {
            OR: [
              { chatRoomId: roomId }, // Replace with actual chatId variable
              { groupRoomId: roomId }, // Replace with actual groupId variable
              { channelRoomId: roomId }, // Replace with actual channelId variable
            ],
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                imgURL: true,
              },
            },
            attachments: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });
        
        const filteredMessages = messages
        .map(({ deletedAt, attachments, user, ...rest }) => ({
          ...rest,
          imgURL: user && user.imgURL,
          userName: user && user.name, 
          attachments: attachments.map(({ deletedAt, ...attachmentRest }) => attachmentRest),
        })).reverse();
        roomData = roomData as roomData;
        const filteredRoomData = roomData ? {roomType, id: roomData.id, roomName: roomType === "chat" ? `${roomData.name} ${roomData.lastName}` : roomData.name, imgURL: roomData.imgURL, isActive: roomData.status, lastActiveTime: roomData.lastActive, numberOfMembers: count } : null;

        socket.join(`${roomId}`);
        socket.emit('enterChat', {roomData: filteredRoomData, messages: filteredMessages});
      } catch (error) {
        console.error('Error in enterChat:', error);
        socket.emit('error', 'Failed to load chat');
      }
    });
    
    // Event for sending a new message
    socket.on('sendMessage', async (data) => {
      const { text, attachments } = data;
      let { roomId } = data;
      console.log("data received: ", roomId, text, attachments); // d02f2ae5-ae23-4ac4-a2bf-9bb5e8926bbc qwerty []
      let roomType = roomId.split("-")[0];
      
      if (roomType !== "chat" || roomType !== "group" || roomType !== "channel") {
        roomId = await createNewChat(socket.userId!, roomId);
        roomType = 'chat';
      }
      let uploadedAttachments: string[] = [];

      if (attachments && attachments.length > 0) {
        try {
          // Upload each attachment to S3
          const uploadPromises = attachments.map(async (attachment: any) => {
            const { fileName, fileBuffer, mimeType } = attachment;
            const s3Params = {
              Bucket: process.env.BUCKET_NAME, // Replace with your bucket name
              Key: `${Date.now()}-${fileName}`,
              Body: Buffer.from(fileBuffer), // Convert file buffer to a Buffer object
              ContentType: mimeType,
            };
            const command = new PutObjectCommand(s3Params);
            await s3.send(command)
          });
    
          const uploadResults = await Promise.all(uploadPromises);
          uploadedAttachments = uploadResults.map((result) => result.Location); // Get URLs

          
          attachments.map(async (attachment: string) => {
            await prisma.attachments.create({
              data: {
                messageId: socket.userId!,
                fileUrl: attachment
              }
            })
          })
        } catch (err) {
          console.error('Error uploading attachments:', err);
          socket.emit('uploadError', { message: 'Attachment upload failed!' });
          return;
        }
      }

      
      let message;
      try {
        console.log({data: {
          chatRoomId: roomType === 'chat' ? roomId : null,
          groupRoomId: roomType === 'group' ? roomId : null,
          channelRoomId: roomType === 'channel' ? roomId : null,
          userId: socket.userId!,
          text,
        }})

        message = await prisma.messages.create({
          data: {
            chatRoomId: roomType === 'chat' ? roomId : null,
            groupRoomId: roomType === 'group' ? roomId : null,
            channelRoomId: roomType === 'channel' ? roomId : null,
            userId: socket.userId!,
            text,
          },
        });
      } catch (err) {
        console.log(err);
        socket.emit('uploadError', { message: 'Attachment upload failed!' });
      }
      
      // Notify all users in the chat about the new message
      io.in(`${roomId}`).emit('newMessage', {message, uploadedAttachments});
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