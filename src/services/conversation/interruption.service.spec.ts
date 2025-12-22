import { Test, TestingModule } from "@nestjs/testing";
import { InterruptionService } from "./interruption.service";

describe("InterruptionService", () => {
  let service: InterruptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InterruptionService],
    }).compile();

    service = module.get<InterruptionService>(InterruptionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleUserStartedSpeaking", () => {
    it("should create interrupt event", async () => {
      const callId = "call123";
      const event = await service.handleUserStartedSpeaking(callId, {
        agentWasSpeaking: true,
      });

      expect(event).toBeDefined();
      expect(event.callId).toBe(callId);
      expect(event.agentWasSpeaking).toBe(true);
      expect(event.interruptType).toBe("barge-in");
    });

    it("should store interrupt in active interrupts", async () => {
      const callId = "call123";
      await service.handleUserStartedSpeaking(callId);

      const active = service.getActiveInterrupt(callId);
      expect(active).not.toBeNull();
      expect(active?.callId).toBe(callId);
    });

    it("should have active interrupt after handling", async () => {
      const callId = "call123";
      await service.handleUserStartedSpeaking(callId);

      expect(service.hasActiveInterrupt(callId)).toBe(true);
    });
  });

  describe("captureInterruptUtterance", () => {
    it("should capture utterance for active interrupt", async () => {
      const callId = "call123";
      await service.handleUserStartedSpeaking(callId);

      const utterance = "I don't have time, just call me back";
      const event = await service.captureInterruptUtterance(callId, utterance);

      expect(event).not.toBeNull();
      expect(event?.userUtterance).toBe(utterance);
    });

    it("should return null if no active interrupt", async () => {
      const event = await service.captureInterruptUtterance(
        "nonexistent",
        "test"
      );
      expect(event).toBeNull();
    });
  });

  describe("clearInterrupt", () => {
    it("should clear active interrupt", async () => {
      const callId = "call123";
      await service.handleUserStartedSpeaking(callId);
      expect(service.hasActiveInterrupt(callId)).toBe(true);

      service.clearInterrupt(callId);
      expect(service.hasActiveInterrupt(callId)).toBe(false);
    });
  });

  describe("handleRetellEvent", () => {
    it("should handle user_started_speaking event", async () => {
      const callId = "call123";
      const retellEvent = {
        event: "user_started_speaking",
        timestamp: Date.now(),
      };

      await service.handleRetellEvent(callId, retellEvent);

      expect(service.hasActiveInterrupt(callId)).toBe(true);
    });

    it("should handle user_interrupted event", async () => {
      const callId = "call123";
      const retellEvent = {
        event: "function_call.user_interrupted",
        timestamp: Date.now(),
      };

      await service.handleRetellEvent(callId, retellEvent);

      expect(service.hasActiveInterrupt(callId)).toBe(true);
    });

    it("should ignore other events", async () => {
      const callId = "call123";
      const retellEvent = {
        event: "agent_started_speaking",
      };

      await service.handleRetellEvent(callId, retellEvent);

      expect(service.hasActiveInterrupt(callId)).toBe(false);
    });
  });

  describe("pauseAgentSpeech", () => {
    it("should pause speech without error", async () => {
      const callId = "call123";
      await expect(service.pauseAgentSpeech(callId)).resolves.not.toThrow();
    });
  });
});

