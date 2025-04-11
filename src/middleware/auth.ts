import { AuthenticatedSocket } from "../interfaces/interfaces.js";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ExtendedError, Server} from "socket.io";
import { parse } from "cookie";

export const socketAuthMiddleware = async (socket: AuthenticatedSocket, next: (err?: ExtendedError | undefined) => void) => {
	const cookies = socket.handshake.headers.cookie;
	if (!cookies) return next(new Error("Authentication error"));

	const parsedCookies = parse(cookies);
	let token = parsedCookies.accessToken;
	const refreshToken = parsedCookies.refreshToken;

	// If no access token but refresh token exists, try to refresh
	if (!token && refreshToken) {
		try {
			const decodedRefreshToken = verifyRefreshToken(refreshToken);
			if (decodedRefreshToken) {
				const newAccessToken = generateAccessToken(decodedRefreshToken.id);
				token = newAccessToken;
			}
		} catch (error) {
			return next(new Error('Authentication error'));
		}
	}

	if (!token) return next(new Error('Authentication error'));
	
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!, async (err, decoded) => {
		if (err) {
			// If token is expired but we have refresh token, try to refresh
			if (err.name === 'TokenExpiredError' && refreshToken) {
				try {
					const decodedRefreshToken = verifyRefreshToken(refreshToken);
					if (decodedRefreshToken) {
						const newAccessToken = generateAccessToken(decodedRefreshToken.id);
						// Verify the new token
						jwt.verify(newAccessToken, process.env.ACCESS_TOKEN_SECRET!, (err, decoded) => {
							if (err) return next(new Error('Authentication error'));
							socket.userId = (decoded as { id: string }).id;
							next();
						});
						return;
					}
				} catch (error) {
					return next(new Error('Authentication error'));
				}
			}
			return next(new Error('Authentication error'));
		}
	
		// Attach the user ID to the socket
		socket.userId = (decoded as { id: string }).id;
		next();
	});
}

const verifyRefreshToken = (token: string): JwtPayload | null => {
	try {
		return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET!) as JwtPayload;
	} catch (error) {
		return null;
	}
};

const generateAccessToken = (userId: string) => {
	const accessToken = jwt.sign({ id: userId, token: "ACCESS" }, process.env.ACCESS_TOKEN_SECRET!, { expiresIn: '15m' }); // Access token expires in 15 minutes
	return accessToken;
}

const generateRefreshToken = (userId: string) => {
	const refreshToken = jwt.sign({ id: userId, token: "REFRESH" }, process.env.REFRESH_TOKEN_SECRET!, { expiresIn: '90d' }); // refresh token expires in 7 days
	return refreshToken;
}