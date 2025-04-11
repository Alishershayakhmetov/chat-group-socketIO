import { Redis } from "ioredis";
import { createNewChat, getUserRoomsListWithLastMessage } from "../../helper/socketFunctions.js";
import { AuthenticatedSocket } from "../../interfaces/interfaces.js";
import { fetchUserNameAndLastName, generatePresignedUrls, saveAttachments, saveMessage } from "../../helper/sendMessage.js";
import { prisma } from "../../prismaClient.js";
import { Server } from "socket.io";

export const setupMessageEvents = (socket: AuthenticatedSocket, publisher: Redis, io: Server) => {
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
	
		const userName = await fetchUserNameAndLastName(socket.userId!);
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

	// Fetch older messages
	socket.on("getOlderMessages", async ({ roomId, lastMessageId, lastMessageCreatedAt }) => {
		console.log(roomId, lastMessageId, lastMessageCreatedAt);
		try {
			const olderMessages = await prisma.messages.findMany({
				where: {
					// First ensure we're only getting messages from this specific room
					OR: [
						{ chatRoomId: roomId },
						{ groupRoomId: roomId },
						{ channelRoomId: roomId }
					],
					// Then filter for messages older than our reference point
					AND: [
						{
							OR: [
								{
									createdAt: { lt: lastMessageCreatedAt }
								},
								{
									createdAt: lastMessageCreatedAt,
									id: { lt: lastMessageId }
								}
							]
						}
					]
				},
				include: {
					attachments: true,
					user: {
						select: { id: true, name: true, imgURL: true },
					},
					originalMsg: {
						select: {
							text: true,
							user: {
								select: {
									name: true,
									lastName: true
								},
							},
						},
					},
					forwardedMsg: {
						select : {
							user: {
								select: { id: true, name: true, imgURL: true },
							},
							chat: { select: { id: true } },
							group: { select: { id: true, name: true, imgURL: true } },
							channel: { select: { id: true, name: true, imgURL: true } },
						}
					}
				},
				orderBy: [
					{ createdAt: 'desc' },
					{ id: 'desc' },
 				],
				take: 10,
			});

			// Convert BigInt to string before sending
			const olderMessagesWithStringFileSize = olderMessages.map(message => ({
				...message,
				attachments: message.attachments.map((attachment) => ({
					...attachment,
					fileName: attachment.name,
					fileURL: attachment.fileUrl,
					fileSize: attachment.fileSize?.toString()
				}))
			}));

			socket.emit("olderMessages", olderMessagesWithStringFileSize.reverse());
		} catch (error) {
			console.error("Error fetching older messages:", error);
			socket.emit("olderMessages", []);
		}
	});
};