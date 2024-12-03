/*
  Warnings:

  - You are about to drop the `chats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_room_id_fkey";

-- DropForeignKey
ALTER TABLE "user_permissions" DROP CONSTRAINT "user_permissions_room_id_fkey";

-- DropForeignKey
ALTER TABLE "users_chats" DROP CONSTRAINT "UserChat_room_id_chat_fkey";

-- DropTable
DROP TABLE "chats";
