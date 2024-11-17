/*
  Warnings:

  - You are about to drop the column `createdAt` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `fileType` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `fileUrl` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `messageId` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `channelImage` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `chats` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `chats` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `groupImage` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `ownerId` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `isEdited` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `messages` table. All the data in the column will be lost.
  - The primary key for the `user_permissions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `chat_id` on the `user_permissions` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `googleId` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `isAdmin` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastActive` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `lastName` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `profileImage` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `users` table. All the data in the column will be lost.
  - The primary key for the `users_chats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `joinedAt` on the `users_chats` table. All the data in the column will be lost.
  - You are about to drop the column `roomId` on the `users_chats` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `users_chats` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[google_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `file_type` to the `attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_url` to the `attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `message_id` to the `attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_id` to the `channels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `channels` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `chats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `owner_id` to the `groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `groups` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_id` to the `user_permissions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `users` table without a default value. This is not possible if the table is not empty.
  - Added the required column `room_id` to the `users_chats` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `users_chats` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "attachments" DROP CONSTRAINT "attachments_messageId_fkey";

-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_roomId_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_userId_fkey";

-- DropForeignKey
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_chat_id_fkey";

-- DropForeignKey
ALTER TABLE "users_chats" DROP CONSTRAINT "UserChat_room_id_channel_fkey";

-- DropForeignKey
ALTER TABLE "users_chats" DROP CONSTRAINT "UserChat_room_id_chat_fkey";

-- DropForeignKey
ALTER TABLE "users_chats" DROP CONSTRAINT "UserChat_room_id_group_fkey";

-- DropForeignKey
ALTER TABLE "users_chats" DROP CONSTRAINT "users_chats_userId_fkey";

-- DropIndex
DROP INDEX "attachments_messageId_idx";

-- DropIndex
DROP INDEX "channels_ownerId_idx";

-- DropIndex
DROP INDEX "groups_ownerId_idx";

-- DropIndex
DROP INDEX "messages_roomId_idx";

-- DropIndex
DROP INDEX "messages_userId_idx";

-- DropIndex
DROP INDEX "users_googleId_key";

-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "createdAt",
DROP COLUMN "fileType",
DROP COLUMN "fileUrl",
DROP COLUMN "messageId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "file_type" TEXT NOT NULL,
ADD COLUMN     "file_url" TEXT NOT NULL,
ADD COLUMN     "message_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "channels" DROP COLUMN "channelImage",
DROP COLUMN "createdAt",
DROP COLUMN "isPublic",
DROP COLUMN "ownerId",
ADD COLUMN     "channel_image" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "owner_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "chats" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "createdAt",
DROP COLUMN "groupImage",
DROP COLUMN "ownerId",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "group_image" TEXT,
ADD COLUMN     "owner_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "createdAt",
DROP COLUMN "isEdited",
DROP COLUMN "roomId",
DROP COLUMN "updatedAt",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_edited" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "room_id" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_pkey",
DROP COLUMN "chat_id",
ADD COLUMN     "room_id" TEXT NOT NULL,
ADD CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id", "room_id", "permission_id");

-- AlterTable
ALTER TABLE "users" DROP COLUMN "createdAt",
DROP COLUMN "deletedAt",
DROP COLUMN "googleId",
DROP COLUMN "isAdmin",
DROP COLUMN "lastActive",
DROP COLUMN "lastName",
DROP COLUMN "profileImage",
DROP COLUMN "updatedAt",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "google_id" TEXT,
ADD COLUMN     "is_admin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_active" TIMESTAMP(3),
ADD COLUMN     "last_name" TEXT,
ADD COLUMN     "profile_image" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users_chats" DROP CONSTRAINT "users_chats_pkey",
DROP COLUMN "joinedAt",
DROP COLUMN "roomId",
DROP COLUMN "userId",
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "room_id" TEXT NOT NULL,
ADD COLUMN     "user_id" TEXT NOT NULL,
ADD CONSTRAINT "users_chats_pkey" PRIMARY KEY ("user_id", "room_id");

-- CreateIndex
CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");

-- CreateIndex
CREATE INDEX "channels_owner_id_idx" ON "channels"("owner_id");

-- CreateIndex
CREATE INDEX "groups_owner_id_idx" ON "groups"("owner_id");

-- CreateIndex
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");

-- CreateIndex
CREATE INDEX "messages_room_id_idx" ON "messages"("room_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channels" ADD CONSTRAINT "channels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_chats" ADD CONSTRAINT "users_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_chats" ADD CONSTRAINT "UserChat_room_id_chat_fkey" FOREIGN KEY ("room_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_chats" ADD CONSTRAINT "UserChat_room_id_group_fkey" FOREIGN KEY ("room_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_chats" ADD CONSTRAINT "UserChat_room_id_channel_fkey" FOREIGN KEY ("room_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
