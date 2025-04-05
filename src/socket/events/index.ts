import { Server, Socket } from "socket.io";
import { Redis } from "ioredis";
import { prisma } from "../../prismaClient.js";
import { AuthenticatedSocket } from "../../interfaces/interfaces.js";
import { getUserRoomsListWithLastMessage } from "../../helper/socketFunctions.js";
import { setupChatEvents } from "./chat.js";
import { setupMessageEvents } from "./message.js";
import { setupGroupEvents } from "./group.js";
import { setupChannelEvents } from "./channel.js";

export const setupEventHandlers = (io: Server, publisher: Redis, redis: Redis) => {
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
			
      // Setup all event handlers
      setupChatEvents(socket, publisher);
			setupMessageEvents(socket, publisher, io);
      setupGroupEvents(socket, publisher);
      setupChannelEvents(socket, publisher);

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
};