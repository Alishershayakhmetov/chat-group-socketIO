/*
  Warnings:

  - You are about to drop the column `channel_image` on the `channels` table. All the data in the column will be lost.
  - You are about to drop the column `group_image` on the `groups` table. All the data in the column will be lost.
  - You are about to drop the column `profile_image` on the `users` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "users_last_name_trgm_idx";

-- DropIndex
DROP INDEX "users_name_trgm_idx";

-- AlterTable
ALTER TABLE "channels" DROP COLUMN "channel_image",
ADD COLUMN     "img_url" TEXT;

-- AlterTable
ALTER TABLE "groups" DROP COLUMN "group_image",
ADD COLUMN     "img_url" TEXT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "profile_image",
ADD COLUMN     "img_url" TEXT;
