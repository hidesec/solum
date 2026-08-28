# @solumjs/grpc

gRPC support for SolumJS framework.

## Features

- Service definitions with decorators
- gRPC server with TCP transport
- gRPC client with retry support
- Streaming support (unary, server, client, bidirectional)

## Installation

```bash
npm install @solumjs/grpc
```

## Usage

### Define a gRPC Service

```typescript
import { GrpcService, GrpcMethod } from "@solumjs/grpc";

@GrpcService("UserService")
class UserService {
  @GrpcMethod("GetUser", { requestType: "GetUserRequest", responseType: "User" })
  async getUser(data: { id: string }) {
    return { id: data.id, name: "John", email: "john@example.com" };
  }

  @GrpcMethod("CreateUser", { requestType: "CreateUserRequest", responseType: "User" })
  async createUser(data: { name: string; email: string }) {
    return { id: "1", ...data };
  }
}
```

### Create and Start Server

```typescript
import { createGrpcServer, getGrpcServiceDefinition } from "@solumjs/grpc";

const services = [getGrpcServiceDefinition(UserService)];
const server = createGrpcServer(services, { port: 50051 });

await server.start();
console.log("gRPC server started on port 50051");
```

### Use Client

```typescript
import { createGrpcClient } from "@solumjs/grpc";

const client = createGrpcClient({ host: "127.0.0.1", port: 50051 });

const user = await client.invoke("UserService", "GetUser", { id: "1" });
console.log(user);

await client.close();
```

### Streaming

```typescript
import { GrpcService, GrpcMethod, GrpcStream } from "@solumjs/grpc";

@GrpcService("ChatService")
class ChatService {
  @GrpcMethod("SendMessage", { type: "bidirectional" })
  @GrpcStream("bidirectional")
  async *sendMessage(stream: AsyncIterable<{ message: string }>) {
    for await (const msg of stream) {
      yield { message: `Echo: ${msg.message}` };
    }
  }
}
```

## API Reference

### Decorators

- `@GrpcService(serviceName)` - Mark a class as a gRPC service
- `@GrpcMethod(methodName, options)` - Mark a method as a gRPC method
- `@GrpcStream(streamType)` - Mark a method as streaming

### Server

- `createGrpcServer(services, options)` - Create a gRPC server
- `server.start()` - Start listening for connections
- `server.stop()` - Gracefully stop the server

### Client

- `createGrpcClient(options)` - Create a gRPC client
- `client.invoke(service, method, data)` - Invoke a gRPC method
- `client.close()` - Close the connection

## License

MIT
