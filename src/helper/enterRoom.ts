import { prisma } from "../prismaClient.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../S3Client.js";

interface attachment { 
	id: string,
	key: string, 
	name: string, 
	isNamePersist: boolean, 
	fileSize: number | null,
	fileBase64Blur: string,
}

export async function getRoomData(userId: string, roomId: string) {
	let roomType;
	if (roomId === "savedMessages") {
		roomType = "savedMessages"
	}
	roomType = roomId.split("-")[0];
	let roomData: any, count, chatRoomId;

	if (roomType === 'chat') {
		roomData = await prisma.chats.findUniqueOrThrow({ where: { id: roomId } });
		const chatUser = await prisma.usersRooms.findFirst({
			where: { chatRoomId: roomId, NOT: { userId } },
		});
		roomData = chatUser ? await prisma.users.findUnique({ where: { id: chatUser.userId } }) : null;
	} 
	else if (roomType === 'group') {
		roomData = await prisma.groups.findUniqueOrThrow({ where: { id: roomId } });
		count = await prisma.usersRooms.count({ where: { groupRoomId: roomData.id } });
	} 
	else if (roomType === 'channel') {
		roomData = await prisma.channels.findUniqueOrThrow({ where: { id: roomId } });
		count = await prisma.usersRooms.count({ where: { channelRoomId: roomData.id } });

		const isMember = await prisma.usersRooms.findFirst({
			where: {
				userId, channelRoomId: roomData.id
			}
		});

		roomData["isMember"] = isMember === null ? false : true
	} 
	else if (roomType == "savedMessages") {
			
	}
	else {
		chatRoomId = (
			await prisma.usersRooms.groupBy({
				by: ['chatRoomId'],
				where: { userId: { in: [userId, roomId] } },
				_count: { userId: true },
				having: { userId: { _count: { equals: 2 } } },
			})
		)?.[0]?.chatRoomId;
		roomData = await prisma.users.findUniqueOrThrow({ where: { id: roomId } });
		roomType = "user";
	}

	return { roomData, roomType, count, chatRoomId };
}

export async function getChatMessages(roomId: string) {
	return prisma.messages.findMany({
		where: {
			OR: [
				{ chatRoomId: roomId },
				{ groupRoomId: roomId },
				{ channelRoomId: roomId },
			],
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
		orderBy: { createdAt: 'desc' },
		take: 10,
	});
}

export async function processMessages(messages: any[]) {
	return Promise.all(
		messages.map(async ({ deletedAt, attachments, user, ...rest }) => {
			const signedAttachments = await Promise.all(
				attachments.map(async ({ key, name, isNamePersist, fileSize, id, fileBase64Blur } : attachment) => {

					let command = new GetObjectCommand({
						Bucket: process.env.BUCKET_NAME1,
						Key: key,
						...(isNamePersist && { ResponseContentDisposition: `attachment; filename=${name}` }),
					});

					const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
					return { id, fileURL: url, fileName: name, saveAsMedia: isNamePersist, fileSize: fileSize ? fileSize.toString() : null, fileBase64Blur  };
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
}

export function formatRoomData(roomData: any, roomType: string, roomId: string, chatRoomId: string | undefined | null, count?: number) {
    if (!roomData) return null;

    return {
			roomType,
			id: roomType === "user" && chatRoomId ? chatRoomId : roomId,
			roomName: roomType === "chat" || roomType === "user" ? `${roomData.name} ${roomData.lastName}` : roomData.name,
			imgURL: roomData.imgURL,
			isActive: roomData.status,
			lastActiveTime: roomData.lastActive,
			numberOfMembers: count,
			...(roomType === "channel" ? { isMember: roomData.isMember ? true : false } : {}),
			...((roomType === "channel" || roomType === "group") && { ownerId: roomData.ownerId })
    };
}
