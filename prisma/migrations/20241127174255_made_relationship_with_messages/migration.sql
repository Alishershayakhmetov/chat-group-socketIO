-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_user_id_fkey";

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_user_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_group_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_channel_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
