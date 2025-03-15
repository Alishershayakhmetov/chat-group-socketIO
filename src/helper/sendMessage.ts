import { prisma } from "../prismaClient.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../S3Client.js";
  
  /**
   * Saves a message in the database.
   */
export async function saveMessage(userId: string, roomId: string, roomType: string, text: string) {
    try {
      return await prisma.messages.create({
        data: {
          chatRoomId: roomType === 'chat' ? roomId : null,
          groupRoomId: roomType === 'group' ? roomId : null,
          channelRoomId: roomType === 'channel' ? roomId : null,
          userId,
          text,
        },
      });
    } catch (err) {
      console.error("Error creating message:", err);
      return null;
    }
  }
  
  /**
   * Saves attachments related to a message.
   */
export async function saveAttachments(messageId: string, attachments: { key: string; name: string; url: string; saveAsMedia: boolean; fileSize: number }[]) {
    await prisma.attachments.createMany({
      data: attachments.map(att => ({
        fileUrl: att.url,
        key: att.key,
        name: att.name,
        isNamePersist: att.saveAsMedia,
        messageId,
        fileSize: att.fileSize
      })),
    });
  }
  
  /**
   * Fetches the username of a given user.
   */
export async function fetchUserName(userId: string) {
    return prisma.users.findUnique({
      where: { id: userId },
      select: { name: true },
    }).then(user => user?.name);
  }
  
  /**
   * Generates presigned URLs for attachments.
   */
export async function generatePresignedUrls(attachments: { key: string; name: string; saveAsMedia: boolean; fileSize: number }[]) {
    return Promise.all(
      attachments.map(async (attachment) => {
        try {
          const command = new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME1,
            Key: attachment.key,
            ...(attachment.saveAsMedia && { ResponseContentDisposition: `attachment; filename=${attachment.name}` }),
          });
  
          const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
          return { saveAsMedia: attachment.saveAsMedia, fileURL: presignedUrl, fileName: attachment.name, fileSize: attachment.fileSize };
        } catch (error) {
          console.error(`Error generating presigned URL for key: ${attachment.key}`, error);
          return { saveAsMedia: attachment.saveAsMedia, fileURL: null, fileName: attachment.name, fileSize: attachment.fileSize };
        }
      })
    );
  }