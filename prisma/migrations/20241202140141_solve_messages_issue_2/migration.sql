/*
  Warnings:

  - You are about to drop the column `room_id` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `room_type` on the `messages` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users_chats" DROP CONSTRAINT "UserChat_room_id_channel_fkey";

-- DropForeignKey
ALTER TABLE "users_chats" DROP CONSTRAINT "UserChat_room_id_group_fkey";

-- DropIndex
DROP INDEX "messages_room_id_idx";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "room_id",
DROP COLUMN "room_type",
ADD COLUMN     "channel_room_id" TEXT,
ADD COLUMN     "group_room_id" TEXT,
ADD COLUMN     "original_message_id" TEXT,
ADD COLUMN     "user_room_id" TEXT,
ALTER COLUMN "text" DROP NOT NULL;

-- DropEnum
DROP TYPE "RoomType";

-- CreateIndex
CREATE INDEX "messages_user_room_id_idx" ON "messages"("user_room_id");

-- CreateIndex
CREATE INDEX "messages_group_room_id_idx" ON "messages"("group_room_id");

-- CreateIndex
CREATE INDEX "messages_channel_room_id_idx" ON "messages"("channel_room_id");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "original_message_id" FOREIGN KEY ("original_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_room_id_fkey" FOREIGN KEY ("user_room_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_group_room_id_fkey" FOREIGN KEY ("group_room_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_room_id_fkey" FOREIGN KEY ("channel_room_id") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
