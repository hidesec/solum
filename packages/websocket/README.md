# @solumjs/websocket

WebSocket and STOMP support for SolumJS.

## Installation

```bash
npm install @solumjs/websocket
```

## Features

- WebSocket server
- STOMP protocol support
- Room management
- Event broadcasting

## Usage

```typescript
import { WebSocketModule, OnMessage, BroadcastTo } from "@solumjs/websocket";

@WebSocketModule({ path: "/ws" })
class ChatGateway {
    @OnMessage("chat")
    @BroadcastTo("rooms")
    handleMessage(client: any, payload: { room: string; message: string }) {
        return { room: payload.room, message: payload.message };
    }
}
```
