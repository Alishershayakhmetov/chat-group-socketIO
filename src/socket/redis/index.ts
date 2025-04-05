import { Redis } from "ioredis";
import { Server } from "socket.io";
import { prisma } from "../../prismaClient.js";

export const setupRedis = (io: Server) => {
  const redis = new Redis(process.env.REDIS_URL!);
  const publisher = new Redis(process.env.REDIS_URL!);
  const subscriber = new Redis(process.env.REDIS_URL!);

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

  return { publisher, subscriber, redis };
};