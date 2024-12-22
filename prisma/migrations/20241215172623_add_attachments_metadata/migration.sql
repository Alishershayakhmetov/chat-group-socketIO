/*
  Warnings:

  - Added the required column `isNamePersist` to the `attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `key` to the `attachments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `attachments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "attachments" ADD COLUMN     "isNamePersist" BOOLEAN NOT NULL,
ADD COLUMN     "key" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL;
