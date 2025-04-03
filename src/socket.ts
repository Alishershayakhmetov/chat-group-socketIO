import { Server} from "socket.io";
import { prisma } from "./prismaClient.js"
import { AuthenticatedSocket, UserRoomsList, roomData } from "./interfaces/interfaces.js";
import { socketAuthMiddleware } from "./middleware/auth.js";
import { createNewChat, getUserRoomsListWithLastMessage } from "./helper/socketFunctions.js";
import { performance } from 'perf_hooks';
import { extractSearchQuery, performSearch } from "./helper/searchQuery.js";
import { formatRoomData, getChatMessages, getRoomData, processMessages } from "./helper/enterRoom.js";
import { fetchUserName, generatePresignedUrls, saveAttachments, saveMessage } from "./helper/sendMessage.js";
import { Prisma } from "@prisma/client";

import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL!);

const publisher = new Redis(process.env.REDIS_URL!); // For publishing events
const subscriber = new Redis(process.env.REDIS_URL!); // For subscribing to channels

// Subscribe to Redis channels
subscriber.subscribe('userStatus', (err) => {
  if (err) console.error('Failed to subscribe to user-status:', err);
  else console.log('Subscribed to user-status channel');
});

subscriber.subscribe('newMessage', (err) => {
  if (err) console.error('Failed to subscribe to new-message:', err);
  else console.log('Subscribed to new-message channel');
});

subscriber.on('message', async (channel, message) => {
  const event = JSON.parse(message);

  if (channel === 'newMessage') {
    const { roomId, message } = event;

    // Fetch all users who have a record of the chat
    const usersInRoom = await prisma.usersRooms.findMany({
      where: {
        OR: [
          { chatRoomId: roomId },
          { groupRoomId: roomId },
          { channelRoomId: roomId }
        ],
      },
      select: {
        userId: true,
      }
    });

    // Notify all users who are online
    usersInRoom.forEach(async ({ userId }) => {
      const socketIds = await redis.smembers(`user:${userId}:sockets`);
      socketIds.forEach((socketId) => {
        io.to(socketId).emit('newMessageNotification', message);
      });
    });

    // Emit to the room (only for users inside it)
    io.to(roomId).emit('newMessage', message);
  } else if (channel === 'userStatus') {
    const { userId, status, lastSeen } = event;

    const userRooms = await prisma.usersRooms.findMany({
      where: { userId: userId },
      select: {
        chatRoom: {
          select: {
            id: true,
            userRooms: {
              where: { userId: { not: userId } },
              select: {
                user: {
                  select: {
                    id: true
                  },
                },
              },
            },
          }
        },
      }
    });

    const uniqueUserIds = [...new Set(userRooms.map((u) => u.chatRoom?.userRooms[0].user.id))];

    // Notify all users in chat history
    uniqueUserIds.forEach(async (connectedUserId) => {
      const socketIds = await redis.smembers(`user:${connectedUserId}:sockets`);
      socketIds.forEach((socketId) => {
        io.to(socketId).emit('userStatusNotification', { userId, status, lastSeen });
      });
    });
  }
});


const userInclude = Prisma.validator<Prisma.usersInclude>()({
  messages: true,
});

type MessageData = Prisma.usersGetPayload<{
  include: typeof userInclude;
}>;

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
    await prisma.users.update({
      where: {
        id: socket.userId!
      },
      data: {
        status: "online"
      }
    });

    // Store userId -> socket.id in Redis
    await redis.sadd(`user:${socket.userId}:sockets`, socket.id);

    // Publish user online event
    publisher.publish(
      'userStatus',
      JSON.stringify({ userId: socket.userId, status: 'online' })
    );

    const userRooms = await getUserRoomsListWithLastMessage(socket.userId!);
    socket.emit('chats', userRooms);
    socket.emit("userId", socket.userId);

    socket.on('search', async (searchInput) => {
      const search = extractSearchQuery(searchInput);
      if (!search) return;
      
      const searchedResult = await performSearch(search);
      socket.emit("searchResult", searchedResult);
    });

    socket.on('enterChat', async (roomId: string) => {
      try {
          const { roomData, roomType, count, chatRoomId } = await getRoomData(socket.userId!, roomId);
          console.log(roomData, roomType, count, chatRoomId);
          const messages = await getChatMessages(chatRoomId ?? roomId);
          const filteredMessages = await processMessages(messages);
          const filteredRoomData = formatRoomData(roomData, roomType, roomId, chatRoomId, count);
          socket.join(`${filteredRoomData?.id}`);
          socket.emit('enterChat', { roomData: filteredRoomData, messages: filteredMessages });
      } catch (error) {
          console.error('Error in enterChat:', error);
          socket.emit('error', 'Failed to load chat');
      }
    });
    
    socket.on('sendMessage', async (data) => {
      const startTime = performance.now();
      const { text, tempId, attachments, originalMessageId } = data;
      let { roomId } = data;
      let roomType = roomId.split("-")[0];
  
      if (!["chat", "group", "channel"].includes(roomType)) {
        console.log("Invalid room type, creating a new chat...");
        socket.leave(roomId);
        roomId = await createNewChat(socket.userId!, roomId);
        roomType = 'chat';
        socket.join(roomId);
      }
      
      let message = await saveMessage(socket.userId!, roomId, roomType, text, originalMessageId);
      
      if (!message) {
        socket.emit('uploadError', { message: 'Message creation failed!' });
        return;
      }
    
      if (attachments.length > 0) await saveAttachments(message.id, attachments);
      const middleTime = performance.now();
    
      const userName = await fetchUserName(socket.userId!);
      const presignedAttachments = await generatePresignedUrls(attachments);
    
      const formattedData = { ...message, userName, attachments: presignedAttachments, tempId };
      const formattedDataNotification = {roomId, userName: formattedData.userName, userId: formattedData.userId, text: formattedData.text, isAttachment: formattedData.attachments.length !== 0, lastMessageTime: formattedData.createdAt};

      // Publish the new message event
      publisher.publish(
        'newMessage',
        JSON.stringify({ roomId, message: formattedDataNotification })
      );

      const endTime = performance.now();
      console.log(`Execution time: ${endTime - startTime} ms (DB: ${middleTime - startTime} ms)`);
    
      io.in(`${roomId}`).emit('newMessage', formattedData);
    });

    socket.on('openCreateNewGroup', async () => {
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

    socket.on('deleteMessage', async ({ messageId }) => {
      try {
        if (!socket.userId) return socket.emit("error", { msg: "Unauthorized" });

        const message = await prisma.messages.findUnique({ where: {id: messageId} });
        if (!message) return socket.emit("error", { msg: "Message not found" });

        let roomId = message.chatRoomId || message.groupRoomId || message.channelRoomId;
        if (!roomId) return;

        if (message.groupRoomId) {
          const { ownerId } = await prisma.groups.findUniqueOrThrow({ where: { id: message.groupRoomId } });
          if (message.userId !== socket.userId && ownerId !== socket.userId) {
            return socket.emit("error", { msg: "Unauthorized" });
          }
        }
        if (message.channelRoomId) {
          const { ownerId } = await prisma.channels.findUniqueOrThrow({ where: { id: message.channelRoomId } });
          if (message.userId !== socket.userId && ownerId !== socket.userId) {
            return socket.emit("error", { msg: "Unauthorized" });
          }
        }
        if (!message.groupRoomId && !message.channelRoomId && message.userId !== socket.userId) {
          return socket.emit("error", { msg: "Unauthorized" });
        }

        await prisma.messages.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
        io.in(roomId).emit('deleteMessage', messageId);

      } catch (error) {
        console.error("Error deleting message:", error);
        socket.emit("deleteMessage", { success: false, error: error });
      }
    })

    socket.on("editMessage", async (data) => {
      try {
        const { messageId, editedText } = data;

        if (!socket.userId) {
          return socket.emit("error", { msg: "Unauthorized" });
        }

        const message = await prisma.messages.findUnique({ where: {id: messageId} });
        
        if (!message) {
          return socket.emit("error", { msg: "Message not found" });
        }

        if (message.userId !== socket.userId) {
          return socket.emit("error", { msg: "You can only edit your own messages" });
        }

        await prisma.messages.update({
          where: { id: messageId },
          data: { text: editedText, isEdited: true },
        });

        const FormattedMessage = {
          id: message.id,
          updatedAt: new Date(),
          text: editedText,
          isEdited: true
        }

        io.in(`${message.chatRoomId || message.groupRoomId || message.channelRoomId}`).emit('editMessage', FormattedMessage);
        
      } catch (error) {
        console.error("Error editing message:", error);
        socket.emit("deleteMessage", { success: false, error: error });
      }
    })

    socket.on("getRooms", async () => {
      try {
        if (!socket.userId) {
          return socket.emit("error", { msg: "Unauthorized" });
        }

        const userRooms = await getUserRoomsListWithLastMessage(socket.userId!);

        const formattedData = userRooms.map((roomData) => {
          return {
            id: roomData.roomId,
            chatName: roomData.chatName,
            chatImageURL: roomData.chatImageURL
          }
        })        
        socket.emit("getRooms", formattedData);

      } catch (error) {
        console.error("Error getting rooms:", error);
        socket.emit("deleteMessage", { success: false, error: error });
      }
    })

    socket.on("forwardMessages", async (data) => {
      try {
        const { roomIds, message } = data;
    
        if (!socket.userId) {
          return socket.emit("error", { msg: "Unauthorized" });
        }

        if (!roomIds || !message) {
          return socket.emit("forwardMessages", { success: false, error: "Invalid data" });
        }

        // Fetch metadata about the original message
        const originalMessage = await prisma.messages.findUnique({
          where: { id: message.id },
          include: {
            user: { select: { name: true } }, // Sender's name
            chat: { select: { id: true } },
            group: { select: { id: true, name: true } },
            channel: { select: { id: true, name: true } },
          },
        });

        if (!originalMessage) {
          return socket.emit("forwardMessages", { success: false, error: "Original message not found" });
        }
    
        // Create messages for each room
        const createdMessages = await Promise.all(
          roomIds.map(async (roomId: string) => {
            let messageData: any = {
              text: message.text,
              userId: message.userId,
              createdAt: new Date(),
              attachments: {
                connect: message.attachments && message.attachments.map((attachment: any) => ({
                  id: attachment.id,
                })),
              },
              forwardedMessageId: message.id, // Reference to original message
            };
    
            // Determine room type and set the right foreign key
            if (roomId.startsWith("chat-")) {
              messageData.chatRoomId = roomId;
            } else if (roomId.startsWith("group-")) {
              messageData.groupRoomId = roomId;
            } else if (roomId.startsWith("channel-")) {
              messageData.channelRoomId = roomId;
            } else {
              throw new Error(`Invalid room ID: ${roomId}`);
            }
            
            return prisma.messages.create({ data: messageData });
          })
        );

        // Emit the new messages to all rooms
        roomIds.forEach((roomId: string, index: number) => {
          socket.to(roomId).emit("newMessage", createdMessages[index]);
        });
    
        // Send success response
        socket.emit("forwardMessages", { success: true, messages: createdMessages });
    
      } catch (error) {
        console.error("Error forwarding messages:", error);
        socket.emit("forwardMessages", { success: false, error: error });
      }
    });

    /*
    // Fetch older messages
    socket.on("fetchOlderMessages", async ({ roomId, lastMessageId }) => {
      try {
        const olderMessages = await prisma.messages.findMany({
          where: {
            OR: [
              { chatRoomId: roomId },
              { groupRoomId: roomId },
              { channelRoomId: roomId },
            ],
            id: { lt: lastMessageId }, // Fetch messages older than the lastMessageId
          },
          orderBy: { createdAt: "desc" }, // Fetch in descending order
          take: 10, // Limit to 10 messages
        });

        socket.emit("olderMessages", olderMessages);
      } catch (error) {
        console.error("Error fetching older messages:", error);
        socket.emit("olderMessages", []);
      }
    });
    */

    socket.on("getOnlyUserRooms", async ({ groupId }) => {
      try {
        if (!socket.userId) {
          return socket.emit("error", { msg: "Unauthorized" });
        }

        // Get userIds already in the group
        const existingUsers = await prisma.usersRooms.findMany({
          where: { groupRoomId: groupId },
          select: { userId: true },
        });

        const existingUserIds = new Set(existingUsers.map(user => user.userId));

        const userRooms = await prisma.usersRooms.findMany({
          where: { userId: socket.userId },
          orderBy: { lastMessageTime: 'desc' },
          select: {
            chatRoom: {
              select: {
                id: true,
                userRooms: {
                  where: { userId: { not: socket.userId, notIn: Array.from(existingUserIds) } }, // Exclude the current user
                  select: {
                    user: {
                      select: {
                        name: true,
                        lastName: true,
                        imgURL: true,
                        id: true
                      },
                    },
                  },
                },
              }
            },
          }
        });

        console.log(userRooms);

        const formattedData = userRooms
          .map((roomData) => {
            if (!roomData.chatRoom?.userRooms.length) return null;
            return {
              id: roomData.chatRoom.userRooms[0].user.id,
              chatName: roomData.chatRoom.userRooms[0].user.name,
              chatImageURL: roomData.chatRoom.userRooms[0].user.imgURL
            };
          })
          .filter(Boolean); // Remove null or undefined values

        socket.emit("getOnlyUserRooms", formattedData);

      } catch (error) {
        console.error("Error getting rooms:", error);
        socket.emit("deleteMessage", { success: false, error: error });
      }
    })

    socket.on("addUserInGroup", async ({ userIds, groupId }) => {
      try {
        // Find users who are already in the group
        const existingUsers = await prisma.usersRooms.findMany({
          where: {
            groupRoomId: groupId,
            userId: { in: userIds },
          },
          select: { userId: true },
        });
    
        // Filter out already added users
        const existingUserIds = new Set(existingUsers.map(user => user.userId));
        const newUserIds = userIds.filter((userId: string) => !existingUserIds.has(userId));
    
        if (newUserIds.length === 0) {
          return socket.emit("addUserInGroup", { success: false, message: "All users are already in the group" });
        }
    
        // Add only new users
        const addedUsersRooms = await prisma.usersRooms.createMany({
          data: newUserIds.map((userId: string) => ({
            userId,
            groupRoomId: groupId,
          })),
        });
    
        socket.emit("addUserInGroup", { success: true, addedUsersRooms });
      } catch (error) {
        console.error("Error adding users to group:", error);
        socket.emit("addUserInGroup", { success: false, message: "An error occurred" });
      }
    });
    
    socket.on("subscribe", async (roomId: string) => {
      try {
        const data = await prisma.usersRooms.create({
          data: {
            userId: socket.userId!,
            channelRoomId: roomId,
          }
        })
        socket.emit("subscribeChannel", {success: true})
      } catch (error) {
        console.error("Error subscribing new user:", error);
        socket.emit("error", { success: false, message: "An error occurred" });
      }
    })

    // Handle disconnection
    socket.on("disconnect", async () => {
      try {
        console.log(`User disconnected: ${socket.userId}, socketId: ${socket.id}`);
        await redis.srem(`user:${socket.userId}:sockets`, socket.id);
    
        // Check if the user has any active connections left
        const remainingSockets = await redis.scard(`user:${socket.userId}:sockets`);
        const lastActive = new Date();
        if (remainingSockets === 0) {
          await prisma.users.update({
            where: { id: socket.userId },
            data: { status: "offline", lastActive: lastActive },
          });
        }

        // Publish user offline event
        publisher.publish(
          'userStatus',
          JSON.stringify({ userId: socket.userId, status: 'offline', lastSeen: lastActive })
        );
      } catch (error) {
        console.error("Disconnection Error:", error);
      }
    });

  } catch (error) {
    console.error('Error:', error);
    socket.disconnect();
  }
});

export default io;