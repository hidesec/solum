import { Bean } from "@solumjs/core";
import { WebSocketHandler, WsHandler, WsClient, WsMessage } from "@solumjs/websocket";
import { logger } from "@config/logger";

interface ChatMessage {
    type: string;
    room?: string;
    content?: string;
    user?: string;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
};

function escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

const MAX_CHAT_FIELD_LENGTH = 500;

function sanitizeField(value: string | undefined, fallback: string): string {
    if (!value) return fallback;
    return escapeHtml(value.slice(0, MAX_CHAT_FIELD_LENGTH));
}

const rooms = new Map<string, Set<WsClient>>();
const MAX_ROOMS = 100;
const MAX_MESSAGES_PER_SECOND = 20;

/**
 * WebSocket chat handler example.
 * Demonstrates room-based message broadcasting.
 *
 * Connect via: ws://localhost:3000/ws/chat
 *
 * Protocol:
 *   Send: { "type": "join", "room": "general" }
 *   Send: { "type": "message", "content": "Hello!" }
 *   Send: { "type": "leave" }
 *   Recv: { "type": "connected", "message": "Welcome to SolumJS Chat", "clientId": "..." }
 *   Recv: { "type": "joined", "room": "general" }
 *   Recv: { "type": "message", "room": "general", "user": "...", "content": "Hello!", "timestamp": "..." }
 */
@WebSocketHandler("/ws/chat")
@Bean()
export class ChatHandler implements WsHandler {
    handleConnection(client: WsClient) {
        let currentRoom = "general";
        let messageCount = 0;
        let windowStart = Date.now();
        const clientId = crypto.randomUUID().slice(0, 8);

        client.onMessage((msg: WsMessage) => {
            const now = Date.now();
            if (now - windowStart > 1000) {
                messageCount = 0;
                windowStart = now;
            }
            messageCount++;
            if (messageCount > MAX_MESSAGES_PER_SECOND) {
                client.send(JSON.stringify({ type: "error", message: "Rate limit exceeded" }));
                return;
            }

            try {
                const parsed: ChatMessage = JSON.parse(msg.data);

                switch (parsed.type) {
                    case "join": {
                        const room = parsed.room ?? "general";
                        if (rooms.size >= MAX_ROOMS && !rooms.has(room)) {
                            client.send(JSON.stringify({ type: "error", message: "Too many rooms" }));
                            break;
                        }
                        if (!rooms.has(room)) rooms.set(room, new Set());
                        rooms.get(room)!.add(client);
                        currentRoom = room;
                        client.send(JSON.stringify({ type: "joined", room }));
                        logger.info({ room, clientId }, "WebSocket client joined room");
                        break;
                    }

                    case "message": {
                        const roomSet = rooms.get(currentRoom);
                        if (roomSet) {
                            const broadcast = JSON.stringify({
                                type: "message",
                                room: currentRoom,
                                user: clientId,
                                content: sanitizeField(parsed.content, ""),
                                timestamp: new Date().toISOString(),
                            });
                            for (const member of roomSet) {
                                member.send(broadcast);
                            }
                        }
                        break;
                    }

                    case "leave": {
                        rooms.get(currentRoom)?.delete(client);
                        client.send(JSON.stringify({ type: "left", room: currentRoom }));
                        currentRoom = "general";
                        break;
                    }

                    default:
                        client.send(JSON.stringify({ type: "error", message: "Unknown type" }));
                }
            } catch {
                client.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
            }
        });

        client.onClose(() => {
            rooms.get(currentRoom)?.delete(client);
            logger.info({ clientId }, "WebSocket client disconnected");
        });

        client.send(JSON.stringify({ type: "connected", message: "Welcome to SolumJS Chat", clientId }));
    }
}
