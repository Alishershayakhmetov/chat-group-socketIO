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
    const userRooms = await getUserRoomsListWithLastMessage(socket.userId!);
    socket.emit('chats', userRooms);

    socket.on('search', async (searchInput) => {
      const search = extractSearchQuery(searchInput);
      if (!search) return;
      
      const searchedResult = await performSearch(search);
      socket.emit("searchResult", searchedResult);
    });

    socket.on('enterChat', async (roomId: string) => {
      try {
          const { roomData, roomType, count, chatRoomId } = await getRoomData(socket.userId!, roomId);
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

    socket.on('deleteMessage', async (data) => {
      try {
        const { messageId } = data;

        if (!socket.userId) {
          return socket.emit("error", { msg: "Unauthorized" });
        }

        const message = await prisma.messages.findUnique({ where: {id: messageId} });
        
        if (!message) {
          return socket.emit("error", { msg: "Message not found" });
        }

        if (message.chatRoomId) {
          if (message.userId !== socket.userId) {
            return socket.emit("error", { msg: "You can only delete your own messages" });
          }

          await prisma.messages.update({
            where: { id: messageId },
            data: { deletedAt: new Date() },
          });

          io.in(`${message.chatRoomId}`).emit('deleteMessage', messageId);
        }

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

        if (message.chatRoomId) {
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

          io.in(`${message.chatRoomId}`).emit('editMessage', FormattedMessage);
        }

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
    

  } catch (error) {
    console.error('Error:', error);
    socket.disconnect();
  }
});

export default io;