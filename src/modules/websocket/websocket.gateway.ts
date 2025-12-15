import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger } from "@nestjs/common";

@WebSocketGateway({
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
      : [
          "http://localhost:3000",
          "http://localhost:5173",
          "http://localhost:8080",
          "https://voice-agent-phi-ten.vercel.app",
        ],
    credentials: true,
  },
  namespace: "/live-calls",
})
export class LiveCallsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LiveCallsGateway.name);
  private connectedClients = new Map<string, Socket>();

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
  }

  /**
   * Emit call started event to all connected clients
   */
  emitCallStarted(callData: any) {
    this.logger.log(`Emitting call_started event for call: ${callData.call_id}`);
    this.server.emit("call:started", callData);
  }

  /**
   * Emit call ended event to all connected clients
   */
  emitCallEnded(callData: any) {
    this.logger.log(`Emitting call_ended event for call: ${callData.call_id}`);
    this.server.emit("call:ended", callData);
  }

  /**
   * Emit real-time transcript update
   */
  emitCallTranscript(callId: string, transcript: any) {
    this.logger.debug(`Emitting transcript update for call: ${callId}`);
    this.server.emit("call:transcript", {
      callId,
      transcript,
    });
  }

  /**
   * Emit call state change (mute, hold, transfer, etc.)
   */
  emitCallStateChanged(callId: string, state: any) {
    this.logger.log(`Emitting state change for call: ${callId}`);
    this.server.emit("call:state-changed", {
      callId,
      state,
    });
  }

  /**
   * Emit call updated event (general updates)
   */
  emitCallUpdated(callId: string, updates: any) {
    this.server.emit("call:updated", {
      callId,
      updates,
    });
  }

  /**
   * Subscribe to specific call updates
   */
  @SubscribeMessage("subscribe:call")
  handleSubscribeCall(
    @MessageBody() data: { callId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`Client ${client.id} subscribing to call: ${data.callId}`);
    client.join(`call:${data.callId}`);
  }

  /**
   * Unsubscribe from specific call updates
   */
  @SubscribeMessage("unsubscribe:call")
  handleUnsubscribeCall(
    @MessageBody() data: { callId: string },
    @ConnectedSocket() client: Socket
  ) {
    this.logger.log(`Client ${client.id} unsubscribing from call: ${data.callId}`);
    client.leave(`call:${data.callId}`);
  }
}




