# @solumjs/websocket

WebSocket handlers and STOMP protocol support.

## Install

```bash
npm install @solumjs/websocket
```

## WebSocket Handler

```typescript
import { WebSocketHandler, WsClient, WsMessage, mountWebSocket } from "@solumjs/websocket";

@WebSocketHandler("/ws")
export class ChatHandler implements WsHandler {
    handleConnection(client: WsClient) {
        console.log(`Client ${client.id} connected`);

        client.onMessage((msg: WsMessage) => {
            // Echo back
            client.send(`Echo: ${msg.data}`);
        });

        client.onClose(() => {
            console.log(`Client ${client.id} disconnected`);
        });
    }
}
```

## Mount WebSocket

```typescript
import { mountWebSocket } from "@solumjs/websocket";
import http from "http";

const server = http.createServer(app);
const handlers = new Map([["/ws", chatHandler]]);

mountWebSocket(server, handlers, { authToken: "secret" });
```

## WebSocket Options

```typescript
interface WebSocketOptions {
    authToken?: string; // Required auth token for connection
}
```

## STOMP Handler

```typescript
import { StompHandler, MessageMapping, WsClient } from "@solumjs/websocket";

@StompHandler()
export class StompChatHandler {

    @MessageMapping("/chat")
    onChatMessage(body: string, client: WsClient) {
        // Handle STOMP message at /chat destination
        return `Server received: ${body}`;
    }

    @MessageMapping("/private")
    onPrivateMessage(body: string, client: WsClient) {
        // Handle STOMP message at /private destination
    }
}
```

## STOMP Frame Operations

```typescript
import { parseStompFrame, serializeStompFrame } from "@solumjs/websocket";

// Parse raw STOMP frame
const frame = parseStompFrame("SEND\ndestination:/queue/test\n\nHello World\n\0");
// { command: "SEND", headers: { destination: "/queue/test" }, body: "Hello World" }

// Serialize STOMP frame
const raw = serializeStompFrame("MESSAGE", { destination: "/queue/test" }, "Hi");
```

## WsClient Interface

```typescript
interface WsClient {
    id: string;
    send(data: string | Buffer): void;
    close(code?: number, reason?: string): void;
    onMessage(handler: (msg: WsMessage) => void): void;
    onClose(handler: () => void): void;
    readonly readyState: number;
}

interface WsMessage {
    data: string;
    isBinary: boolean;
}
```

## Security Features

- **Origin validation** — WebSocket upgrade requires matching origin
- **Rate limiting** — 30 upgrades per minute per IP
- **Connection limits** — Max 1000 concurrent connections
- **Idle timeout** — 5 minutes inactivity disconnects
- **Buffer limits** — Max 256KB per client buffer
- **Frame limits** — Max 1MB per WebSocket frame
- **STOMP subscription limits** — Max 100 subscriptions per client
- **STOMP destination limits** — Max 1000 destinations
- **XSS prevention** — STOMP body HTML-escaped before broadcast
- **Internal destination blocking** — `/internal/` and `/system/` destinations denied

## License

MIT
