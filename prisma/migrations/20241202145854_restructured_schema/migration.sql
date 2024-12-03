/*
  Warnings:

  - The primary key for the `users_chats` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `room_id` on the `users_chats` table. All the data in the column will be lost.
  - The required column `id` was added to the `users_chats` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "users_chats" DROP CONSTRAINT "users_chats_pkey",
DROP COLUMN "room_id",
ADD COLUMN     "channel_room_id" TEXT,
ADD COLUMN     "group_room_id" TEXT,
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "user_room_id" TEXT,
ADD CONSTRAINT "users_chats_pkey" PRIMARY KEY ("id");
