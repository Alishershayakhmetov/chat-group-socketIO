import { Socket } from "socket.io";
import { users, groups, channels, chats } from "@prisma/client";

export interface AuthenticatedSocket extends Socket {
    userId?: string;
}

export type roomData = users & groups & channels & chats;

export interface UserRoomsList {
    chatRoom?: {
      id: string;
      messages: {
        text?: string;
        updatedAt: Date;
        originalMessageId?: string;
        user: {
          name?: string;
          lastName?: string;
          imgURL?: string;
        };
      };
      userRooms: {
        user: {
          name: string;
          lastName?: string;
          imgURL?: string;
        };
      };
    };
    groupRoom?: {
      id: string;
      name: string;
      imgURL: string;
      messages: {
        text?: string;
        updatedAt: Date;
        originalMessageId?: string;
      };
    };
    channelRoom?: {
      id: string;
      name: string;
      imgURL: string;
      messages: {
        text?: string;
        updatedAt: Date;
        originalMessageId?: string;
      };
    };
}