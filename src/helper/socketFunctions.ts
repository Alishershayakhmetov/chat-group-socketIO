import { prisma } from "../prismaClient.js";

/*
export async function GetRoomInfo(roomId: string) {
  let roomType = roomId.split("-")[0];
  let roomData;
  let count;
  if(roomType === 'group') {
    roomData = await prisma.groups.findUniqueOrThrow({
    	where: {id: roomId}
    })
    count = await prisma.usersChats.count({
      where: {roomId: roomData.id}
    })
    roomType = "group";
  } else if (roomType === "channel") {
    roomData = await prisma.channels.findUniqueOrThrow({
      where: {id: roomId}
    })
    count = await prisma.usersChats.count({
      where: {roomId: roomData.id}
    })
    roomType = "channel";
  } else {
    roomData = await prisma.users.findUniqueOrThrow({
      where: {id: roomId}
    })
    roomType = "chat";
  }

	return {...roomData, count, roomType};
}
*/

export async function getUserRoomsList(userId: string) {
  const userRooms = await prisma.usersRooms.findMany({
    where: { userId: userId },
    orderBy: { lastMessageTime: 'desc' },
    take: 20,
    select: {
      chatRoom: {
        select: {
          id: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Last message only
            select: {
              text: true,
              updatedAt: true,
              originalMessageId: true,
              user: {
                select: {
                  name: true,
                  lastName: true,
                  imgURL: true
                }
              }
            }
          },
          userRooms: {
            where: { userId: { not: userId } }, // Exclude the current user
            select: {
              user: {
                select: {
                  name: true,
                  lastName: true,
                  imgURL: true,
                },
              },
            },
          },
        }
      },
      groupRoom: {
        select: {
          id: true,
          name: true,
          imgURL: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Last message only
            select: {
              text: true,
              updatedAt: true,
              originalMessageId: true,
              user: {
                select: {
                  name: true,
                  lastName: true,
                  imgURL: true
                }
              }
            }
          }
        }
      },
      channelRoom: {
        select: {
          id: true,
          name: true,
          imgURL: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1, // Last message only
            select: {
              text: true,
              updatedAt: true,
              originalMessageId: true,
              user: {
                select: {
                  name: true,
                  lastName: true,
                  imgURL: true
                }
              }
            }
          }
        }
      }
    }
  });

  const simplifiedRooms = userRooms.map((room) => {
    let simplified = [];
  
    // Process channelRoom
    if (room.channelRoom) {
      const channelMessage = room.channelRoom.messages?.[0];
      channelMessage && simplified.push({
        chatName: room.channelRoom.name,
        chatImageURL: room.channelRoom.imgURL,
        messageUserName: channelMessage?.user ? `${channelMessage.user.name} ${channelMessage.user.lastName}` : null,
        messageText: channelMessage?.text || null,
        lastMessageTime: channelMessage?.updatedAt || null,
        isMessageForwarded: channelMessage.originalMessageId ? Boolean(channelMessage.originalMessageId) : false,
        roomId: room.channelRoom.id,
      });
    }
  
    // Process groupRoom
    if (room.groupRoom) {
      const groupMessage = room.groupRoom.messages?.[0];
      groupMessage && simplified.push({
        chatName: room.groupRoom.name,
        chatImageURL: room.groupRoom.imgURL,
        messageUserName: groupMessage?.user ? `${groupMessage.user.name} ${groupMessage.user.lastName}` : null,
        messageText: groupMessage?.text || null,
        lastMessageTime: groupMessage?.updatedAt || null,
        isMessageForwarded: groupMessage.originalMessageId ? Boolean(groupMessage.originalMessageId) : false,
        roomId: room.groupRoom.id,
      });
    }
  
    // Process chatRoom
    if (room.chatRoom) {
      const chatMessage = room.chatRoom.messages?.[0];
      const chatNameData = room.chatRoom.userRooms?.[0]?.user;
      chatMessage && chatNameData && simplified.push({
        chatName: chatNameData ? `${chatNameData.name} ${chatNameData.lastName}` : null,
        chatImageURL: chatNameData?.imgURL || null,
        messageUserName: chatMessage?.user ? `${chatMessage.user.name} ${chatMessage.user.lastName}` : null,
        messageText: chatMessage?.text || null,
        lastMessageTime: chatMessage?.updatedAt || null,
        isMessageForwarded: chatMessage.originalMessageId ? Boolean(chatMessage.originalMessageId) : false,
        roomId: room.chatRoom.id,
      });
    }
  
    return simplified;
  });
  
  // Flatten the result into a single array
  return simplifiedRooms.flat();
}

export async function createNewChat(userId: string, newUserId: string): Promise<string> {
  if (!userId || !newUserId) {
    throw new Error("Both userId and newUserId are required.");
  }

  const result = await prisma.$transaction(async (prisma) => {
    const newChat = await prisma.chats.create({ data: {} });

    await prisma.usersRooms.createMany({
      data: [
        { userId, chatRoomId: newChat.id },
        { userId: newUserId, chatRoomId: newChat.id },
      ],
    });

    return newChat;
  });

  return result.id;
}