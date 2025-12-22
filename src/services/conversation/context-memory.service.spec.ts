import { Test, TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ContextMemoryService } from "./context-memory.service";
import { VoiceAgent } from "../../schemas/voice-agent.schema";

describe("ContextMemoryService", () => {
  let service: ContextMemoryService;
  let mockAgentModel: any;

  const mockAgent = {
    _id: "agent123",
    fieldSchemas: [
      {
        id: "field1",
        label: "Email Address",
        fieldName: "email",
        dataType: "email",
        required: true,
        displayOrder: 0,
      },
      {
        id: "field2",
        label: "Phone Number",
        fieldName: "phone",
        dataType: "phone",
        required: true,
        displayOrder: 1,
      },
      {
        id: "field3",
        label: "Name",
        fieldName: "name",
        dataType: "text",
        required: false,
        displayOrder: 2,
        nlpExtractionHints: ["name", "my name is"],
      },
    ],
  };

  beforeEach(async () => {
    mockAgentModel = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextMemoryService,
        {
          provide: getModelToken(VoiceAgent.name),
          useValue: mockAgentModel,
        },
      ],
    }).compile();

    service = module.get<ContextMemoryService>(ContextMemoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clear all contexts
    service.clearContext("call123");
  });

  describe("initializeContext", () => {
    it("should initialize context with fields from schema", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const context = await service.initializeContext(
        "call123",
        "agent123"
      );

      expect(context).toBeDefined();
      expect(context.callId).toBe("call123");
      expect(context.agentId).toBe("agent123");
      expect(context.fields).toHaveProperty("email");
      expect(context.fields).toHaveProperty("phone");
      expect(context.fields).toHaveProperty("name");
      expect(context.failedAttempts).toBe(0);
    });

    it("should set initial routing path", async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);

      const context = await service.initializeContext(
        "call123",
        "agent123",
        ["QW Direct"]
      );

      expect(context.routingPath).toEqual(["QW Direct"]);
    });
  });

  describe("updateContext", () => {
    beforeEach(async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      await service.initializeContext("call123", "agent123");
    });

    it("should extract email from utterance", async () => {
      const context = await service.updateContext(
        "call123",
        "My email is john@example.com"
      );

      expect(context.fields.email.filled).toBe(true);
      expect(context.fields.email.value).toBe("john@example.com");
    });

    it("should extract phone from utterance", async () => {
      const context = await service.updateContext(
        "call123",
        "My phone number is 0412 345 678"
      );

      expect(context.fields.phone.filled).toBe(true);
      expect(context.fields.phone.value).toContain("0412");
    });

    it("should extract multiple fields from one utterance", async () => {
      const context = await service.updateContext(
        "call123",
        "My name is John, email is john@example.com, and phone is 0412345678"
      );

      expect(context.fields.name.filled).toBe(true);
      expect(context.fields.email.filled).toBe(true);
      expect(context.fields.phone.filled).toBe(true);
    });

    it("should update last user response", async () => {
      const utterance = "My email is test@example.com";
      const context = await service.updateContext("call123", utterance);

      expect(context.lastUserResponse).toBe(utterance);
    });

    it("should reset failed attempts on valid response", async () => {
      // First, set failed attempts
      service.incrementFailedAttempts("call123");

      const context = await service.updateContext(
        "call123",
        "My email is test@example.com"
      );

      expect(context.failedAttempts).toBe(0);
    });
  });

  describe("isFilled", () => {
    beforeEach(async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      await service.initializeContext("call123", "agent123");
    });

    it("should return false for unfilled field", () => {
      expect(service.isFilled("call123", "email")).toBe(false);
    });

    it("should return true for filled field", async () => {
      await service.updateContext("call123", "email is test@example.com");
      expect(service.isFilled("call123", "email")).toBe(true);
    });
  });

  describe("getMissingRequiredFields", () => {
    beforeEach(async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      await service.initializeContext("call123", "agent123");
    });

    it("should return all required fields when none filled", async () => {
      const missing = await service.getMissingRequiredFields("call123");
      expect(missing).toContain("email");
      expect(missing).toContain("phone");
      expect(missing).not.toContain("name");
    });

    it("should return only unfilled required fields", async () => {
      await service.updateContext("call123", "email is test@example.com");
      const missing = await service.getMissingRequiredFields("call123");
      expect(missing).not.toContain("email");
      expect(missing).toContain("phone");
    });
  });

  describe("getNextUnfilledField", () => {
    beforeEach(async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      await service.initializeContext("call123", "agent123");
    });

    it("should return first field when none filled", async () => {
      const next = await service.getNextUnfilledField("call123");
      expect(next).not.toBeNull();
      expect(next?.fieldName).toBe("email");
    });

    it("should return next field when first is filled", async () => {
      await service.updateContext("call123", "email is test@example.com");
      const next = await service.getNextUnfilledField("call123");
      expect(next?.fieldName).toBe("phone");
    });

    it("should return null when all fields filled", async () => {
      await service.updateContext(
        "call123",
        "email is test@example.com, phone is 0412345678, name is John"
      );
      const next = await service.getNextUnfilledField("call123");
      expect(next).toBeNull();
    });
  });

  describe("incrementFailedAttempts", () => {
    beforeEach(async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      await service.initializeContext("call123", "agent123");
    });

    it("should increment failed attempts", () => {
      const context1 = service.getContext("call123");
      expect(context1?.failedAttempts).toBe(0);

      service.incrementFailedAttempts("call123");
      const context2 = service.getContext("call123");
      expect(context2?.failedAttempts).toBe(1);
    });
  });

  describe("updateRoutingPath", () => {
    beforeEach(async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      await service.initializeContext("call123", "agent123");
    });

    it("should update routing path", () => {
      service.updateRoutingPath("call123", "Evolved Sound");
      const context = service.getContext("call123");
      expect(context?.routingPath).toContain("Evolved Sound");
    });
  });

  describe("clearContext", () => {
    beforeEach(async () => {
      mockAgentModel.findById.mockResolvedValue(mockAgent);
      await service.initializeContext("call123", "agent123");
    });

    it("should clear context", () => {
      expect(service.getContext("call123")).not.toBeNull();
      service.clearContext("call123");
      expect(service.getContext("call123")).toBeNull();
    });
  });
});

