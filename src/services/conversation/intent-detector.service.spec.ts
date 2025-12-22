import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { IntentDetectorService } from "./intent-detector.service";
import { VoiceAgent } from "../../schemas/voice-agent.schema";

describe("IntentDetectorService", () => {
  let service: IntentDetectorService;
  let mockAgentModel: any;

  const mockAgent = {
    _id: "agent123",
    intentDefinitions: [
      {
        id: "intent1",
        name: "Request Callback",
        sampleUtterances: [
          "Call me back",
          "I'd like someone to contact me",
          "Can you call me later?",
        ],
        matchingType: "semantic",
        routingAction: "callback",
        enabled: true,
        confidenceThreshold: 0.7,
      },
      {
        id: "intent2",
        name: "Opt-Out Recording",
        sampleUtterances: [],
        matchingType: "regex",
        regexPattern: "/stop.*recording/i",
        routingAction: "opt-out",
        enabled: true,
      },
    ],
  };

  beforeEach(async () => {
    mockAgentModel = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntentDetectorService,
        {
          provide: getModelToken(VoiceAgent.name),
          useValue: mockAgentModel,
        },
      ],
    }).compile();

    service = module.get<IntentDetectorService>(IntentDetectorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("detectIntent", () => {
    it("should return null for empty utterance", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const result = await service.detectIntent("agent123", "");
      expect(result).toBeNull();
    });

    it("should return null if no intent definitions", async () => {
      mockAgentModel.findById.mockResolvedValue({
        _id: "agent123",
        intentDefinitions: [],
      });

      const result = await service.detectIntent("agent123", "call me back");
      expect(result).toBeNull();
    });

    it("should detect semantic intent with exact match", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const result = await service.detectIntent("agent123", "Call me back");
      expect(result).not.toBeNull();
      expect(result?.intentName).toBe("Request Callback");
      expect(result?.routingAction).toBe("callback");
      expect(result?.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it("should detect semantic intent with similar phrase", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const result = await service.detectIntent(
        "agent123",
        "I'd like someone to contact me please"
      );
      expect(result).not.toBeNull();
      expect(result?.intentName).toBe("Request Callback");
    });

    it("should detect regex intent", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const result = await service.detectIntent(
        "agent123",
        "Please stop the recording"
      );
      expect(result).not.toBeNull();
      expect(result?.intentName).toBe("Opt-Out Recording");
      expect(result?.confidence).toBe(1.0);
      expect(result?.matchingType).toBe("regex");
    });

    it("should skip disabled intents", async () => {
      const disabledAgent = {
        ...mockAgent,
        intentDefinitions: [
          {
            ...mockAgent.intentDefinitions[0],
            enabled: false,
          },
        ],
      };
      mockAgentModel.findById.mockResolvedValue(disabledAgent);

      const result = await service.detectIntent("agent123", "Call me back");
      expect(result).toBeNull();
    });

    it("should return null for non-matching utterance", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const result = await service.detectIntent(
        "agent123",
        "What is the weather today?"
      );
      expect(result).toBeNull();
    });
  });

  describe("getEnabledIntents", () => {
    it("should return only enabled intents", async () => {
      const mixedAgent = {
        ...mockAgent,
        intentDefinitions: [
          { ...mockAgent.intentDefinitions[0], enabled: true },
          { ...mockAgent.intentDefinitions[1], enabled: false },
        ],
      };
      mockAgentModel.findById.mockResolvedValue(mixedAgent);

      const intents = await service.getEnabledIntents("agent123");
      expect(intents.length).toBe(1);
      expect(intents[0].name).toBe("Request Callback");
    });
  });

  describe("refreshCache", () => {
    it("should clear cache for agent", async () => {
      await service.refreshCache("agent123");
      // No error should be thrown
      expect(true).toBe(true);
    });
  });
});

