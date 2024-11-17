/*
  Warnings:

  - You are about to drop the column `chatId` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `profilePicture` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `userChats` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `userPermissions` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `roomId` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_chatId_fkey";

-- DropForeignKey
ALTER TABLE "userChats" DROP CONSTRAINT "UserChat_room_id_channel_fkey";

-- DropForeignKey
ALTER TABLE "userChats" DROP CONSTRAINT "UserChat_room_id_chat_fkey";

-- DropForeignKey
ALTER TABLE "userChats" DROP CONSTRAINT "UserChat_room_id_group_fkey";

-- DropForeignKey
ALTER TABLE "userChats" DROP CONSTRAINT "userChats_userId_fkey";

-- DropForeignKey
ALTER TABLE "userPermissions" DROP CONSTRAINT "userPermissions_chat_id_fkey";

-- DropForeignKey
ALTER TABLE "userPermissions" DROP CONSTRAINT "userPermissions_permission_id_fkey";

-- DropForeignKey
ALTER TABLE "userPermissions" DROP CONSTRAINT "userPermissions_user_id_fkey";

-- DropIndex
DROP INDEX "messages_chatId_idx";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "chatId",
ADD COLUMN     "roomId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "profilePicture",
ADD COLUMN     "profileImage" TEXT;

-- DropTable
DROP TABLE "userChats";

-- DropTable
DROP TABLE "userPermissions";

-- CreateTable
CREATE TABLE "users_chats" (
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_chats_pkey" PRIMARY KEY ("userId","roomId")
);

-- CreateTable
CREATE TABLE "user_permissions" (
    "user_id" TEXT NOT NULL,
    "chat_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "granted_by" TEXT NOT NULL,

    CONSTRAINT "user_permissions_pkey" PRIMARY KEY ("user_id","chat_id","permission_id")
);

-- CreateIndex
CREATE INDEX "messages_roomId_idx" ON "messages"("roomId");

-- AddForeignKey
ALTER TABLE "users_chats" ADD CONSTRAINT "users_chats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_chats" ADD CONSTRAINT "UserChat_room_id_chat_fkey" FOREIGN KEY ("roomId") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_chats" ADD CONSTRAINT "UserChat_room_id_group_fkey" FOREIGN KEY ("roomId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_chats" ADD CONSTRAINT "UserChat_room_id_channel_fkey" FOREIGN KEY ("roomId") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
