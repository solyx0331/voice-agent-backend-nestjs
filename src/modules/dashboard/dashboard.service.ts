import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { VoiceAgent, VoiceAgentDocument } from "../../schemas/voice-agent.schema";
import { Call, CallDocument } from "../../schemas/call.schema";
import { Contact, ContactDocument } from "../../schemas/contact.schema";

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(VoiceAgent.name)
    private agentModel: Model<VoiceAgentDocument>,
    @InjectModel(Call.name)
    private callModel: Model<CallDocument>,
    @InjectModel(Contact.name)
    private contactModel: Model<ContactDocument>
  ) {}

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalCallsToday, activeAgents, allCalls] = await Promise.all([
      this.callModel.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
      }),
      this.agentModel.countDocuments({ status: "active" }),
      this.callModel.find({
        createdAt: { $gte: today, $lt: tomorrow },
      }),
    ]);

    // Calculate average duration
    const durations = allCalls
      .map((call) => {
        const [minutes, seconds] = call.duration.split(":").map(Number);
        return minutes * 60 + seconds;
      })
      .filter((d) => !isNaN(d));

    const avgSeconds =
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    const avgMinutes = Math.floor(avgSeconds / 60);
    const avgSecs = Math.floor(avgSeconds % 60);
    const avgDuration = `${avgMinutes}:${avgSecs.toString().padStart(2, "0")}`;

    // Calculate success rate
    const successfulCalls = allCalls.filter(
      (call) => call.outcome === "success"
    ).length;
    const successRate =
      allCalls.length > 0 ? (successfulCalls / allCalls.length) * 100 : 0;

    // Calculate changes (mock for now)
    const callsChange = 12.5;
    const durationChange = -5.2;
    const successRateChange = 2.1;

    return {
      totalCallsToday,
      activeAgents,
      avgCallDuration: avgDuration,
      successRate: Math.round(successRate * 10) / 10,
      callsChange,
      durationChange,
      successRateChange,
    };
  }

  async getVoiceAgents() {
    const agents = await this.agentModel.find().sort({ createdAt: -1 });

    return agents.map((agent) => ({
      id: agent._id.toString(),
      name: agent.name,
      description: agent.description || "",
      status: agent.status,
      calls: agent.calls,
      avgDuration: agent.avgDuration,
      voice: agent.voice,
      greetingScript: agent.greetingScript,
      faqs: agent.faqs,
      intents: agent.intents,
      callRules: agent.callRules,
      leadCapture: agent.leadCapture,
      notifications: agent.notifications,
      baseLogic: agent.baseLogic,
    }));
  }

  async getAnalyticsData() {
    const calls = await this.callModel.find();
    const agents = await this.agentModel.find();

    // Call volume by day (last 7 days)
    const callVolume = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = calls.filter(
        (call) =>
          call.createdAt >= date && call.createdAt < nextDate
      ).length;

      callVolume.push({
        name: date.toLocaleDateString("en-US", { weekday: "short" }),
        calls: count,
      });
    }

    // Hourly data (last 24 hours)
    const hourlyData = [];
    for (let i = 23; i >= 0; i--) {
      const hour = new Date();
      hour.setHours(hour.getHours() - i, 0, 0, 0);
      const nextHour = new Date(hour);
      nextHour.setHours(nextHour.getHours() + 1);

      const count = calls.filter(
        (call) => call.createdAt >= hour && call.createdAt < nextHour
      ).length;

      hourlyData.push({
        hour: hour.toLocaleTimeString("en-US", {
          hour: "numeric",
          hour12: true,
        }),
        calls: count,
      });
    }

    // Agent performance
    const agentPerformance = agents.map((agent) => {
      const agentId = agent._id.toString();
      const agentCalls = calls.filter(
        (call) =>
          call.agentId?.toString() === agentId || call.agent === agent.name
      );
      const success = agentCalls.filter(
        (call) => call.outcome === "success"
      ).length;

      return {
        name: agent.name,
        calls: agentCalls.length,
        success,
      };
    });

    // Call type data
    const inbound = calls.filter((c) => c.type === "inbound").length;
    const outbound = calls.filter((c) => c.type === "outbound").length;
    const missed = calls.filter((c) => c.type === "missed").length;

    const callTypeData = [
      { name: "Inbound", value: inbound, color: "#3b82f6" },
      { name: "Outbound", value: outbound, color: "#10b981" },
      { name: "Missed", value: missed, color: "#ef4444" },
    ];

    return {
      callVolume,
      hourlyData,
      agentPerformance,
      callTypeData,
    };
  }

  async getLiveCall() {
    // In a real implementation, this would query active calls from a real-time system
    // For now, return null or mock data
    return null;
  }

  async getLiveCalls() {
    // In a real implementation, this would query active calls from a real-time system
    return [];
  }
}

