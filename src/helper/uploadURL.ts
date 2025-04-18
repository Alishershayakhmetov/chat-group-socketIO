import { s3 } from "../S3Client.js";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from 'crypto';
import { promisify } from "util";

const randomBytes = promisify(crypto.randomBytes);

export async function generateUploadURLs(extensions: string[]): Promise<{url: string, key: string}[]> {
	const signedUrls: {url: string, key: string}[] = [];

	for (const extension of extensions) {
		const rawBytes = await randomBytes(16);
		const fileName = rawBytes.toString('hex') + "." + extension;

		const params = {
			Bucket: process.env.BUCKET_NAME1,
			Key: fileName,
			Expires: 60,
		};

		const command = new PutObjectCommand({
			Bucket: params.Bucket,
			Key: params.Key,
		});

		const uploadURL = await getSignedUrl(s3, command, { expiresIn: params.Expires });
		signedUrls.push({url: uploadURL, key: fileName});
	}

	return signedUrls;
}