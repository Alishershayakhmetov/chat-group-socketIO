import { Redis } from "ioredis";
import { AuthenticatedSocket } from "../../interfaces/interfaces.js";
import { prisma } from "../../prismaClient.js";

export const setupChannelEvents = (socket: AuthenticatedSocket, publisher: Redis) => {
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

	socket.on("unsubscribeChannel", async ({ channelId }: { channelId: string }) => {
		try {
			await prisma.usersRooms.delete({
				where: {
					userId_channelRoomId: {
						userId: socket.userId!,
						channelRoomId: channelId
					}
				}
			});
			
			socket.emit("userUnsubscribeChannel", { 
				userId: socket.userId,
				channelId
			});
		} catch (error) {
			console.error("Error leaving group:", error);
			socket.emit("leaveGroupError", { error: "Failed to leave group" });
		}
	});
};