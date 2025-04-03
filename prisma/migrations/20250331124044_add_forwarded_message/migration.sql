-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "forwarded_message_id" TEXT;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "forwarded_message_id" FOREIGN KEY ("forwarded_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
