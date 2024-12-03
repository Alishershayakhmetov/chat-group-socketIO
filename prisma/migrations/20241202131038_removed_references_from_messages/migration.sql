-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_channel_room_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_group_room_id_fkey";

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_user_room_id_fkey";
