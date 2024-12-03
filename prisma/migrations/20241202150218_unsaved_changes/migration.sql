/*
  Warnings:

  - You are about to drop the column `user_room_id` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the `users_chats` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_user_room_id_fkey";

-- DropForeignKey
ALTER TABLE "users_chats" DROP CONSTRAINT "users_chats_user_id_fkey";

-- DropIndex
DROP INDEX "messages_user_room_id_idx";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "user_room_id",
ADD COLUMN     "chat_room_id" TEXT;

-- DropTable
DROP TABLE "users_chats";

-- CreateTable
CREATE TABLE "chats" (
    "id" TEXT NOT NULL DEFAULT concat('chat-', gen_random_uuid()),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users_Rooms" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_room_id" TEXT,
    "group_room_id" TEXT,
    "channel_room_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_Rooms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "messages_chat_room_id_idx" ON "messages"("chat_room_id");

-- AddForeignKey
ALTER TABLE "users_Rooms" ADD CONSTRAINT "users_Rooms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_Rooms" ADD CONSTRAINT "messages_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_Rooms" ADD CONSTRAINT "messages_group_room_id_fkey" FOREIGN KEY ("group_room_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users_Rooms" ADD CONSTRAINT "messages_channel_room_id_fkey" FOREIGN KEY ("channel_room_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;
