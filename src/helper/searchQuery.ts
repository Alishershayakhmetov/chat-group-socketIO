import { prisma } from "../prismaClient.js";

export function extractSearchQuery(searchInput: any): string | null {
    if (!searchInput || !searchInput.query) return null;
    return searchInput.query.trim();
}  
  
export async function performSearch(search: string) {
    return prisma.$queryRaw`
    WITH LastMessages AS (
        SELECT
            channel_room_id,
            chat_room_id,
            MAX(created_at) AS last_message_date
        FROM messages
        GROUP BY channel_room_id, chat_room_id
    ),
    LastMessagesDetails AS (
        SELECT
            m.channel_room_id,
            m.chat_room_id,
            m.text AS last_message_content,
            m.created_at AS last_message_date,
            u.name AS last_message_user
        FROM messages m
        JOIN LastMessages lm
          ON m.channel_room_id = lm.channel_room_id AND m.chat_room_id = lm.chat_room_id AND m.created_at = lm.last_message_date
        JOIN users u
          ON m.user_id = u.id
    )
    ${searchUsersQuery(search)}
    UNION ALL
    ${searchChannelsQuery(search)}
    ORDER BY name_similarity DESC, last_name_similarity DESC;`;
}

function searchUsersQuery(search: string) {
    return prisma.$queryRaw`
    SELECT 
        'user' AS type,
        u.id,
        u.name,
        u.last_name,
        similarity(u.name, ${search}) AS name_similarity,
        similarity(u.last_name, ${search}) AS last_name_similarity,
        NULL AS is_public,
        u.img_url AS imgURL,
        NULL AS last_message_content,
        NULL AS last_message_date,
        NULL AS last_message_user
    FROM users u
    WHERE u.name % ${search} OR u.last_name % ${search}`;
}

function searchChannelsQuery(search: string) {
    return prisma.$queryRaw`
    SELECT 
        'channel' AS type,
        c.id,
        c.name,
        NULL AS last_name,
        similarity(c.name, ${search}) AS name_similarity,
        NULL AS last_name_similarity,
        c.is_public AS is_public,
        c.img_url AS imgURL,
        lmd.last_message_content,
        lmd.last_message_date,
        lmd.last_message_user
    FROM channels c
    LEFT JOIN LastMessagesDetails lmd
      ON c.id = lmd.channel_room_id
    WHERE c.name % ${search} AND c.is_public = true`;
}
