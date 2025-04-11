import { prisma } from "../prismaClient.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3 } from "../S3Client.js";
  
  /**
   * Saves a message in the database.
   */
export async function saveMessage(userId: string, roomId: string, roomType: string, text: string, originalMessageId: string | null | undefined) {
    try {
      return await prisma.messages.create({
        data: {
          chatRoomId: roomType === 'chat' ? roomId : null,
          groupRoomId: roomType === 'group' ? roomId : null,
          channelRoomId: roomType === 'channel' ? roomId : null,
          userId,
          text,
          originalMessageId: originalMessageId 
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
export async function saveAttachments(messageId: string, attachments: { key: string; name: string; url: string; saveAsMedia: boolean; fileSize: number; fileBase64Blur: string }[]) {
    await prisma.attachments.createMany({
      data: attachments.map(att => ({
        fileUrl: att.url,
        key: att.key,
        name: att.name,
        isNamePersist: att.saveAsMedia,
        messageId,
        fileSize: att.fileSize,
        fileBase64Blur: att.fileBase64Blur
      })),
    });
  }
  
  /**
   * Fetches the username of a given user.
   */
export async function fetchUserNameAndLastName(userId: string) {
    return prisma.users.findUnique({
      where: { id: userId },
      select: { name: true, lastName: true },
    }).then(user => user?.name + " " + user?.lastName);
  }
  
  /**
   * Generates presigned URLs for attachments.
   */
export async function generatePresignedUrls(attachments: { key: string; name: string; saveAsMedia: boolean; fileSize: number; fileBase64Blur: string }[]) {
    return Promise.all(
      attachments.map(async (attachment) => {
        try {
          const command = new GetObjectCommand({
            Bucket: process.env.BUCKET_NAME1,
            Key: attachment.key,
            ...(attachment.saveAsMedia && { ResponseContentDisposition: `attachment; filename=${attachment.name}` }),
          });
  
          const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
          return { saveAsMedia: attachment.saveAsMedia, fileURL: presignedUrl, fileName: attachment.name, fileSize: attachment.fileSize, fileBase64Blur: attachment.fileBase64Blur };
        } catch (error) {
          console.error(`Error generating presigned URL for key: ${attachment.key}`, error);
          return { saveAsMedia: attachment.saveAsMedia, fileURL: null, fileName: attachment.name, fileSize: attachment.fileSize, fileBase64Blur: attachment.fileBase64Blur };
        }
      })
    );
  }