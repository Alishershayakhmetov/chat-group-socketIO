import { Socket } from "socket.io";
import { Redis } from "ioredis";
import { getRoomData, getChatMessages, processMessages, formatRoomData } from "../../helper/enterRoom.js";
import { extractSearchQuery, performSearch } from "../../helper/searchQuery.js";
import { AuthenticatedSocket } from "../../interfaces/interfaces.js";

export const setupChatEvents = (socket: AuthenticatedSocket, publisher: Redis) => {
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
  
};