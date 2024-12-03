/*
  Warnings:

  - Added the required column `room_type` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('USER', 'GROUP', 'CHANNEL');

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "room_type" "RoomType" NOT NULL;
