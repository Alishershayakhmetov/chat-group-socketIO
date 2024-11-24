import { Socket } from "socket.io";
import { users, groups, channels, chats } from "@prisma/client";

export interface AuthenticatedSocket extends Socket {
    userId?: string;
}

export type roomData = users & groups & channels & chats;