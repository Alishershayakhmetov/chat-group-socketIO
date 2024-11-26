/*
  Warnings:

  - You are about to drop the column `file_type` on the `attachments` table. All the data in the column will be lost.
  - You are about to drop the column `content` on the `messages` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `messages` table. All the data in the column will be lost.
  - Added the required column `text` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "attachments" DROP COLUMN "file_type";

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "content",
DROP COLUMN "date",
ADD COLUMN     "text" TEXT NOT NULL;
