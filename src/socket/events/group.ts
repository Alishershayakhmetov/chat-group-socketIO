import { Redis } from "ioredis";
import { AuthenticatedSocket } from "../../interfaces/interfaces.js";
import { prisma } from "../../prismaClient.js";
import { Server } from "socket.io";

export const setupGroupEvents = (socket: AuthenticatedSocket, publisher: Redis, io: Server) => {
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
				name: roomData.chatRoom.userRooms[0].user.name,
				lastName: roomData.chatRoom.userRooms[0].user.lastName,
				imgURL: roomData.chatRoom.userRooms[0].user.imgURL
				};
			})
			.filter(Boolean); // Remove null or undefined values

			socket.emit("getOnlyUserRooms", formattedData);

		} catch (error) {
			console.error("Error getting rooms:", error);
			socket.emit("deleteMessage", { success: false, error: error });
		}
	})

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

	socket.on("getOnlyUsersInGroup", async ({groupId}) => {
		try {
			const members = await prisma.usersRooms.findMany({
				where: {
					groupRoomId: groupId
				},
				select: {
					userId: true
				}
			})

			const userIds = members.filter(member => member.userId !== socket.userId).map(member => member.userId);
	
			const membersData = await prisma.users.findMany({
				where: {
					id: { in: userIds }
				},
				select: {
					id: true,
					name: true,
					lastName: true,
					imgURL: true
				}
			});
			socket.emit("getOnlyUsersInGroup", membersData);
		} catch (error) {
			console.error("Error getting group members:", error);
	  		socket.emit("error", "Failed to fetch group members");
		}
	});

	socket.on("deleteMembersFromGroup", async ({groupId, membersIds} : {groupId: string, membersIds: string[]}) => {
		try {
			// verify the user has permission to delete members

			// Delete the user-group relationships
			await prisma.usersRooms.deleteMany({
				where: {
					groupRoomId: groupId,
					userId: { in: membersIds }
				}
			});

			// Notify all group members about the change
			io.to(groupId).emit("deleteMembersFromGroup", { 
				groupId, 
				deletedMembers: membersIds
			});
		} catch (error) {
			console.error("Error deleting members from group:", error);
			socket.emit("error", "Failed to delete members from group");
		}
	});

	socket.on("leaveGroup", async ({ groupId }: { groupId: string }) => {
		try {
			await prisma.usersRooms.delete({
				where: {
					userId_groupRoomId: {
						userId: socket.userId!,
						groupRoomId: groupId
					}
				}
			});
			
			socket.to(groupId).emit("userLeftGroup", { 
				userId: socket.userId,
				groupId 
			});
		} catch (error) {
			console.error("Error leaving group:", error);
			socket.emit("leaveGroupError", { error: "Failed to leave group" });
		}
	});
};