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

/**
 * WebSocket chat handler example.
 * Demonstrates room-based message broadcasting.
 *
 * Connect via: ws://localhost:3000/ws/chat
 *
 * Protocol:
 *   Send: { "type": "join", "room": "general" }
 *   Send: { "type": "message", "content": "Hello!", "user": "Alice" }
 *   Send: { "type": "leave" }
 *   Recv: { "type": "connected", "message": "Welcome to SolumJS Chat" }
 *   Recv: { "type": "joined", "room": "general" }
 *   Recv: { "type": "message", "room": "general", "user": "Alice", "content": "Hello!", "timestamp": "..." }
 */
@WebSocketHandler("/ws/chat")
@Bean()
export class ChatHandler implements WsHandler {
    handleConnection(client: WsClient) {
        let currentRoom = "general";

        client.onMessage((msg: WsMessage) => {
            try {
                const parsed: ChatMessage = JSON.parse(msg.data);

                switch (parsed.type) {
                    case "join": {
                        const room = parsed.room ?? "general";
                        if (!rooms.has(room)) rooms.set(room, new Set());
                        rooms.get(room)!.add(client);
                        currentRoom = room;
                        client.send(JSON.stringify({ type: "joined", room }));
                        logger.info({ room }, "WebSocket client joined room");
                        break;
                    }

                    case "message": {
                        const roomSet = rooms.get(currentRoom);
                        if (roomSet) {
                            const broadcast = JSON.stringify({
                                type: "message",
                                room: currentRoom,
                                user: sanitizeField(parsed.user, "anonymous"),
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
                        client.send(JSON.stringify({ type: "error", message: `Unknown type: ${parsed.type}` }));
                }
            } catch {
                client.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
            }
        });

        client.onClose(() => {
            rooms.get(currentRoom)?.delete(client);
            logger.info("WebSocket client disconnected");
        });

        client.send(JSON.stringify({ type: "connected", message: "Welcome to SolumJS Chat" }));
    }
}
