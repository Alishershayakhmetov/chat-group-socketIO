import dotenv from "dotenv";

// const envFile = process.env.NODE_ENV === "production" ? ".env.production" : ".env.development";
// dotenv.config({ path: envFile });

dotenv.config();

export default {
	WEBAPP_URL: process.env.WEBAPP_URL,
	API_GATEWAY_URL: process.env.API_GATEWAY_URL,

	EMAIL_HOST: process.env.EMAIL_HOST,
	EMAIL_PORT: process.env.EMAIL_PORT,
	EMAIL_USER: process.env.EMAIL_USER,
	EMAIL_PASS: process.env.EMAIL_PASS,

	REDIS_URL: process.env.REDIS_URL,
	ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
	REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,

	BUCKET_NAME: process.env.BUCKET_NAME,
	BUCKET_REGION: process.env.BUCKET_REGION,
	BUCKET_ACCESS_KEY: process.env.BUCKET_ACESS_KEY,
	BUCKET_SECRET_ACCESS_KEY: process.env.BUCKET_SECRET_ACCESS_KEY,
}