import { AuthenticatedSocket } from "../interfaces/interfaces.js";
import jwt from "jsonwebtoken";
import { ExtendedError, Server} from "socket.io";
import { parse } from "cookie";

// Middleware for validating JWT Access token from cookies
export const socketAuthMiddleware = (socket: AuthenticatedSocket, next: (err?: ExtendedError | undefined) => void) => {
  const cookies = socket.handshake.headers.cookie;
  if (!cookies) return next(new Error("Authentication error"));

  const parsedCookies = parse(cookies);
  const token = parsedCookies.accessToken;

  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, async (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
  
    // Attach the user ID to the socket
    socket.userId = (decoded as { id: string }).id;
    next();
  });
}