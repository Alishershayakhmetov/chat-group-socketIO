/*
  Warnings:

  - You are about to drop the column `groupId` on the `channels` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "channels" DROP CONSTRAINT "channels_groupId_fkey";

-- AlterTable
ALTER TABLE "channels" DROP COLUMN "groupId";
