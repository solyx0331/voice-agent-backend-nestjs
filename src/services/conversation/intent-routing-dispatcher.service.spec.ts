import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { IntentRoutingDispatcherService, RoutingContext } from "./intent-routing-dispatcher.service";
import { IntentDetectorService, IntentMatchResult } from "./intent-detector.service";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";

describe("IntentRoutingDispatcherService", () => {
  let service: IntentRoutingDispatcherService;
  let intentDetector: IntentDetectorService;
  let agentModel: Model<VoiceAgentDocument>;

  const mockAgentModel = {
    findById: jest.fn(),
  };

  const mockIntentDetector = {
    detectIntent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentRoutingDispatcherService,
        {
          provide: getModelToken(VoiceAgent.name),
          useValue: mockAgentModel,
        },
        {
          provide: IntentDetectorService,
          useValue: mockIntentDetector,
        },
      ],
    }).compile();

    service = module.get<IntentRoutingDispatcherService>(IntentRoutingDispatcherService);
    intentDetector = module.get<IntentDetectorService>(IntentDetectorService);
    agentModel = module.get<Model<VoiceAgentDocument>>(getModelToken(VoiceAgent.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("dispatch", () => {
    it("should dispatch to callback handler when callback intent is detected", async () => {
      const intentMatch: IntentMatchResult = {
        intentName: "Request Callback",
        confidence: 0.9,
        matchingType: "semantic",
        routingAction: "callback",
      };

      mockIntentDetector.detectIntent.mockResolvedValue(intentMatch);

      const result = await service.dispatch("agent-123", "Can someone call me back?");

      expect(result.action).toBe("callback");
      expect(result.success).toBe(true);
      expect(result.message).toContain("call you back");
      expect(result.shouldEndCall).toBe(false);
      expect(result.metadata?.requiresFields).toEqual(["name", "phone"]);
    });

    it("should dispatch to quote handler when quote intent is detected", async () => {
      const intentMatch: IntentMatchResult = {
        intentName: "Request Quote",
        confidence: 0.85,
        matchingType: "semantic",
        routingAction: "quote",
      };

      mockIntentDetector.detectIntent.mockResolvedValue(intentMatch);

      const result = await service.dispatch("agent-123", "I need a quote");

      expect(result.action).toBe("quote");
      expect(result.success).toBe(true);
      expect(result.message).toContain("quote");
      expect(result.metadata?.requiresFields).toEqual(["product", "quantity", "budget"]);
    });

    it("should fallback to continue-flow when no intent matches", async () => {
      mockIntentDetector.detectIntent.mockResolvedValue(null);

      const result = await service.dispatch("agent-123", "Hello");

      expect(result.action).toBe("continue-flow");
      expect(result.success).toBe(true);
      expect(result.metadata?.fallback).toBe(true);
    });

    it("should fallback to continue-flow when unknown routing action is detected", async () => {
      const intentMatch: IntentMatchResult = {
        intentName: "Unknown Intent",
        confidence: 0.8,
        matchingType: "semantic",
        routingAction: "unknown-action",
      };

      mockIntentDetector.detectIntent.mockResolvedValue(intentMatch);

      const result = await service.dispatch("agent-123", "Some utterance");

      expect(result.action).toBe("continue-flow");
      expect(result.success).toBe(true);
      expect(result.metadata?.fallback).toBe(true);
    });

    it("should handle opt-out intent correctly", async () => {
      const intentMatch: IntentMatchResult = {
        intentName: "Opt-Out Recording",
        confidence: 0.95,
        matchingType: "regex",
        routingAction: "opt-out",
      };

      mockIntentDetector.detectIntent.mockResolvedValue(intentMatch);

      const result = await service.dispatch("agent-123", "Stop recording");

      expect(result.action).toBe("opt-out");
      expect(result.success).toBe(true);
      expect(result.message).toContain("stop the recording");
      expect(result.metadata?.stopRecording).toBe(true);
    });

    it("should handle transfer intent correctly", async () => {
      const intentMatch: IntentMatchResult = {
        intentName: "Request Transfer",
        confidence: 0.9,
        matchingType: "semantic",
        routingAction: "transfer",
      };

      mockIntentDetector.detectIntent.mockResolvedValue(intentMatch);

      const result = await service.dispatch("agent-123", "Can I speak to a human?");

      expect(result.action).toBe("transfer");
      expect(result.success).toBe(true);
      expect(result.message).toContain("transfer");
      expect(result.metadata?.transferToHuman).toBe(true);
    });

    it("should handle end-call intent correctly", async () => {
      const intentMatch: IntentMatchResult = {
        intentName: "End Call",
        confidence: 0.9,
        matchingType: "semantic",
        routingAction: "end-call",
      };

      mockIntentDetector.detectIntent.mockResolvedValue(intentMatch);

      const result = await service.dispatch("agent-123", "Goodbye");

      expect(result.action).toBe("end-call");
      expect(result.success).toBe(true);
      expect(result.shouldEndCall).toBe(true);
    });

    it("should pass context to handler", async () => {
      const intentMatch: IntentMatchResult = {
        intentName: "Request Callback",
        confidence: 0.9,
        matchingType: "semantic",
        routingAction: "callback",
      };

      mockIntentDetector.detectIntent.mockResolvedValue(intentMatch);

      const context = {
        collectedFields: { name: "John Doe" },
        callId: "call-123",
        transcript: "Can someone call me back?",
      };

      const result = await service.dispatch("agent-123", "Can someone call me back?", context);

      expect(result.action).toBe("callback");
      expect(result.success).toBe(true);
    });

    it("should handle errors gracefully and fallback", async () => {
      mockIntentDetector.detectIntent.mockRejectedValue(new Error("Detection failed"));

      const result = await service.dispatch("agent-123", "Some utterance");

      expect(result.action).toBe("continue-flow");
      expect(result.success).toBe(true);
      expect(result.metadata?.fallback).toBe(true);
    });
  });

  describe("getRoutingActionDescription", () => {
    it("should return description for known routing actions", () => {
      const description = service.getRoutingActionDescription("callback");
      expect(description).toContain("Collect contact information");
    });

    it("should return custom message for unknown actions", () => {
      const description = service.getRoutingActionDescription("custom-action");
      expect(description).toContain("Custom routing action");
    });
  });

  describe("getAllRoutingActions", () => {
    it("should return all routing action descriptions", () => {
      const actions = service.getAllRoutingActions();
      expect(actions).toHaveProperty("callback");
      expect(actions).toHaveProperty("quote");
      expect(actions).toHaveProperty("continue-flow");
    });
  });

  describe("hasHandler", () => {
    it("should return true for registered handlers", () => {
      expect(service.hasHandler("callback")).toBe(true);
      expect(service.hasHandler("quote")).toBe(true);
      expect(service.hasHandler("continue-flow")).toBe(true);
    });

    it("should return false for unregistered handlers", () => {
      expect(service.hasHandler("unknown-action")).toBe(false);
    });
  });

  describe("getCustomRoutingActions", () => {
    it("should return custom routing actions from agent", async () => {
      mockAgentModel.findById.mockResolvedValue({
        customRoutingActions: ["schedule-appointment", "check-status"],
      });

      const actions = await service.getCustomRoutingActions("agent-123");

      expect(actions).toEqual(["schedule-appointment", "check-status"]);
    });

    it("should return empty array if agent has no custom actions", async () => {
      mockAgentModel.findById.mockResolvedValue({
        customRoutingActions: [],
      });

      const actions = await service.getCustomRoutingActions("agent-123");

      expect(actions).toEqual([]);
    });

    it("should return empty array if agent not found", async () => {
      mockAgentModel.findById.mockResolvedValue(null);

      const actions = await service.getCustomRoutingActions("agent-123");

      expect(actions).toEqual([]);
    });
  });

  describe("registerHandler", () => {
    it("should register a custom handler", async () => {
      const customHandler = jest.fn().mockResolvedValue({
        action: "custom-action",
        success: true,
        message: "Custom handler executed",
      });

      service.registerHandler("custom-action", customHandler);

      // Create a mock intent match with custom action
      const intentMatch: IntentMatchResult = {
        intentName: "Custom Intent",
        confidence: 0.9,
        matchingType: "semantic",
        routingAction: "custom-action",
      };

      mockIntentDetector.detectIntent.mockResolvedValue(intentMatch);

      const result = await service.dispatch("agent-123", "Custom utterance");

      expect(customHandler).toHaveBeenCalled();
      expect(result.action).toBe("custom-action");
      expect(result.message).toBe("Custom handler executed");
    });
  });
});

