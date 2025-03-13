import { Server} from "socket.io";
import { prisma } from "./prismaClient.js"
import { AuthenticatedSocket, UserRoomsList, roomData } from "./interfaces/interfaces.js";
import { socketAuthMiddleware } from "./middleware/auth.js";
import { s3 } from "./S3Client.js";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createNewChat, getUserRoomsList } from "./helper/socketFunctions.js";
import { performance } from 'perf_hooks';

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
        let chatRoomId;
        if(roomType === 'chat') {
          roomData = await prisma.chats.findUniqueOrThrow({
            where: {id: roomId}
          })
          roomData = await prisma.usersRooms.findFirst({
            where: {
              chatRoomId: roomId,
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
          chatRoomId = (
            await prisma.usersRooms.groupBy({
              by: ['chatRoomId'], // Group by chatRoomId
              where: {
                userId: { in: [socket.userId!, roomId] }, // Match both user IDs
              },
              _count: {
                userId: true, // Count userId occurrences
              },
              having: {
                userId: { _count: { equals: 2 } }, // Ensure exactly two matches
              },
            })
          )?.[0]?.chatRoomId;

          roomData = await prisma.users.findUniqueOrThrow({
            where: {id: roomId}
          })
          roomType = "user";
        }
        const messages = await prisma.messages.findMany({
          where: {
            OR: [
              { chatRoomId: chatRoomId? chatRoomId : roomId },
              { groupRoomId: roomId },
              { channelRoomId: roomId },
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

        // Generate pre-signed URLs for attachments
        const filteredMessages = await Promise.all(
          messages.map(async ({ deletedAt, attachments, user, ...rest }) => {
            const signedAttachments = await Promise.all(
              attachments.map(async ({ key, name, isNamePersist, fileSize }) => {
                console.log(`key of object: ${key}`)

                let command = new GetObjectCommand({
                  Bucket: process.env.BUCKET_NAME1,
                  Key: key,
                });
                if (isNamePersist) {
                  command = new GetObjectCommand({
                    Bucket: process.env.BUCKET_NAME1,
                    Key: key,
                    ResponseContentDisposition: `attachment; filename=${name}`,
                  });
                }
                
                const url = await getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour expiration
                return { fileURL: url, fileName: name, saveAsMedia: isNamePersist, fileSize };
              })
            );

            return {
              ...rest,
              imgURL: user?.imgURL,
              userName: user?.name,
              attachments: signedAttachments,
            };
          }).reverse()
        );

        roomData = roomData as roomData;
        const filteredRoomData = roomData ? {roomType, id: roomType === "user" && chatRoomId ? chatRoomId : roomId, roomName: roomType === "chat" || "user" ? `${roomData.name} ${roomData.lastName}` : roomData.name, imgURL: roomData.imgURL, isActive: roomData.status, lastActiveTime: roomData.lastActive, numberOfMembers: count } : null;

        socket.join(`${filteredRoomData?.id}`);
        socket.emit('enterChat', {roomData: filteredRoomData, messages: filteredMessages});
      } catch (error) {
        console.error('Error in enterChat:', error);
        socket.emit('error', 'Failed to load chat');
      }
    });
    
    socket.on('sendMessage', async (data) => {
      const startTime = performance.now();
      const { text, tempId , attachments } : {text: string, tempId: string, attachments: {key: string, name: string, url: string, saveAsMedia: boolean}[]}= data;
      let { roomId } = data;
      let roomType = roomId.split("-")[0];
      console.log("data received: ", roomId, text, attachments, `roomType: ${roomType}`);

      if (!["chat", "group", "channel"].includes(roomType)) {
        console.log("fly to the moon")
        socket.leave(roomId);
        roomId = await createNewChat(socket.userId!, roomId);
        roomType = 'chat';
        socket.join(roomId);
      }
      
      let message;
      try {
        console.log("qwerty ", {data: {
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
        socket.emit('uploadError', { message: 'Message creating failed!' });
        return;
      }

      for (const attachment of attachments) {
        await prisma.attachments.create({
          data: {
            fileUrl: attachment.url,
            key: attachment.key,
            name: attachment.name,
            isNamePersist: attachment.saveAsMedia,
            messageId: message.id
          }
        })
      }

      const middleTime = performance.now();

      const userName = (await prisma.users.findUnique({
        where: {id: socket.userId!},
        select: {
          name: true
        }
      }))?.name;

      // Generate presigned URLs for attachments using GetObjectCommand
      const presignedAttachments = await Promise.all(
        attachments.map(async (attachment) => {
          try {

            let command = new GetObjectCommand({
              Bucket: process.env.BUCKET_NAME1,
              Key: attachment.key,
            });
            if (attachment.saveAsMedia) {
              command = new GetObjectCommand({
                Bucket: process.env.BUCKET_NAME1,
                Key: attachment.key,
                ResponseContentDisposition: `attachment; filename=${attachment.name}`,
              });
            }

            const presignedUrl = await getSignedUrl(
              s3,
              command,
              { expiresIn: 3600 } // 1 hour
            );
            return {
              saveAsMedia: attachment.saveAsMedia,
              fileURL: presignedUrl,
              fileName: attachment.name
            };
          } catch (error) {
            console.error(`Error generating presigned URL for key: ${attachment.key}`, error);
            return {
              saveAsMedia: attachment.saveAsMedia,
              fileURL: null,
              fileName: attachment.name
            }; // Handle error gracefully
          }
        })
      );

      const formattedData = {...message, userName, attachments: presignedAttachments, tempId};

      const endTime = performance.now();
      console.log(`Function executed in ${endTime - startTime} ms ${middleTime - startTime} ms`);

      // Notify all users in the chat about the new message
      io.in(`${roomId}`).emit('newMessage', formattedData);
    });

    socket.on('openCreateNewGroup', async () => { // N + 1 problem
      try {
        // Fetch the second person who has chatted with the current user
        const userChats = await prisma.usersRooms.findMany({
          where: {
            userId: socket.userId,
            chatRoomId: { not: null }, // Ensure the user is part of a chat room
          },
          include: {
            chatRoom: {
              include: {
                userRooms: true,  // Explicitly include the userRooms relation
              },
            },
          },
        });
    
        // Check for chat rooms and get the second user in each
        const otherUsers = userChats.map((chat) => {
          // Find the second person who isn't the current user
          const secondPerson = chat.chatRoom!.userRooms.find(
            (room) => room.userId !== socket.userId
          );
          return secondPerson ? secondPerson.userId : null;
        }).filter((id): id is string => id !== null); // Filter out null values    

        if (otherUsers.length > 0 ) {
          // Fetch user details for the other users
          const usersInfo = await prisma.users.findMany({
            where: {
              id: { in: otherUsers },
            },
            select: {
              id: true,
              name: true,
              lastName: true,
              imgURL: true,
              status: true,
            },
          });

          // Notify the client about the successful group creation
          socket.emit("openCreateNewGroup", {success: true, users: usersInfo});
        } else {
          socket.emit("groupCreationError", "No other users found.");
        }
      } catch (error) {
        console.error("Error creating group:", error);
        socket.emit("openCreateNewGroup", {success: false, message: "An error occurred while finding users"});
      }
    });

    socket.on('createNewGroup', async (data) => {
      try {
        const { title, uploadedImage, users } : {title: string, uploadedImage: {key: string, name: string, url: string, saveAsMedia: boolean}, users: string[]} = data;
        const newGroup = await prisma.groups.create({
          data: {
            name: title,
            ownerId: socket.userId!,
            imgURL: uploadedImage ? uploadedImage.url : null
          }
        })

        // Ensure the owner is included in the users list
        const allUsers = Array.from(new Set([...users, socket.userId!]));
        // Add users to the group
        await prisma.usersRooms.createMany({
          data: allUsers.map((userId) => ({
            userId,
            groupRoomId: newGroup.id,
          })),
        });

        socket.emit("groupCreated", { roomId: newGroup.id, chatImgURL: newGroup.imgURL, chatName: newGroup.name });
      } catch (error) {
        console.error("Error creating group:", error);
        socket.emit("groupCreated", { success: false, error: error });
      }
    })

    socket.on('createNewChannel', async (data) => {
      try {
        const { title, uploadedImage } : {title: string, uploadedImage: {key: string, name: string, url: string, saveAsMedia: boolean}} = data;

        const newChannel = await prisma.channels.create({
          data: {
            name: title,
            ownerId: socket.userId!,
            imgURL: uploadedImage ? uploadedImage.url : null
          }
        })

        await prisma.usersRooms.create({
          data: {
            userId: socket.userId!,
            channelRoomId: newChannel.id,
          }
        });

        socket.emit("createNewChannel", { roomId: newChannel.id, chatImgURL: newChannel.imgURL, chatName: newChannel.name });
      } catch (error) {
        console.error("Error creating group:", error);
        socket.emit("createNewChannel", { success: false, error: error });
      }
    })

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