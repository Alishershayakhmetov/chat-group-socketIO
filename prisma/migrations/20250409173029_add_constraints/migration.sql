/*
  Warnings:

  - A unique constraint covering the columns `[user_id,group_room_id]` on the table `users_Rooms` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,channel_room_id]` on the table `users_Rooms` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[user_id,chat_room_id]` on the table `users_Rooms` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "users_Rooms_user_id_group_room_id_key" ON "users_Rooms"("user_id", "group_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_Rooms_user_id_channel_room_id_key" ON "users_Rooms"("user_id", "channel_room_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_Rooms_user_id_chat_room_id_key" ON "users_Rooms"("user_id", "chat_room_id");
