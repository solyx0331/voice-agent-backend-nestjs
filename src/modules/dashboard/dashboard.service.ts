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

    // Calculate yesterday's date range
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Calculate this month's date range for success rate
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const [totalCallsToday, activeAgents, allCallsToday, allCallsYesterday, activeCalls, allCallsThisMonth] = await Promise.all([
      this.callModel.countDocuments({
        createdAt: { $gte: today, $lt: tomorrow },
      }),
      this.agentModel.countDocuments({ status: "active" }),
      this.callModel.find({
        createdAt: { $gte: today, $lt: tomorrow },
      }),
      this.callModel.find({
        createdAt: { $gte: yesterday, $lt: today },
      }),
      // Get currently active calls (status: "ongoing" or calls that started but haven't ended)
      this.callModel.find({
        status: "ongoing",
      }),
      // Get all calls from this month for success rate calculation
      this.callModel.find({
        createdAt: { $gte: thisMonthStart, $lt: thisMonthEnd },
      }),
    ]);

    // Helper function to calculate average duration in seconds
    const calculateAvgDurationSeconds = (calls: CallDocument[]): number => {
      const durations = calls
        .map((call) => {
          const [minutes, seconds] = call.duration.split(":").map(Number);
          return minutes * 60 + seconds;
        })
        .filter((d) => !isNaN(d));

      return durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    };

    // Helper function to calculate success rate
    // A call is considered successful if:
    // 1. outcome === "success", OR
    // 2. status === "completed" AND outcome is not explicitly "caller_hung_up" or "speech_not_recognized"
    const calculateSuccessRate = (calls: CallDocument[]): number => {
      if (calls.length === 0) return 0;
      const successfulCalls = calls.filter((call) => {
        // Explicit success
        if (call.outcome === "success") return true;
        // If status is completed and no negative outcome, consider it successful
        if (call.status === "completed" && !call.outcome) return true;
        // If status is completed and outcome is not explicitly negative
        if (call.status === "completed" && call.outcome && call.outcome !== "caller_hung_up" && call.outcome !== "speech_not_recognized") {
          return true;
        }
        return false;
      }).length;
      return (successfulCalls / calls.length) * 100;
    };

    // Calculate today's metrics
    const avgSecondsToday = calculateAvgDurationSeconds(allCallsToday);
    const avgMinutes = Math.floor(avgSecondsToday / 60);
    const avgSecs = Math.floor(avgSecondsToday % 60);
    const avgDuration = `${avgMinutes}:${avgSecs.toString().padStart(2, "0")}`;
    
    // Calculate success rate for this month (not just today)
    const successRateThisMonth = calculateSuccessRate(allCallsThisMonth);
    
    // For comparison, calculate yesterday's success rate
    const successRateYesterday = calculateSuccessRate(allCallsYesterday);

    // Calculate yesterday's metrics
    const totalCallsYesterday = allCallsYesterday.length;
    const avgSecondsYesterday = calculateAvgDurationSeconds(allCallsYesterday);

    // Calculate percentage changes
    // Formula: ((today - yesterday) / yesterday) * 100
    const callsChange =
      totalCallsYesterday > 0
        ? ((totalCallsToday - totalCallsYesterday) / totalCallsYesterday) * 100
        : totalCallsToday > 0
        ? 100 // If yesterday had 0 calls and today has calls, it's 100% increase
        : 0; // If both are 0, no change

    const durationChange =
      avgSecondsYesterday > 0
        ? ((avgSecondsToday - avgSecondsYesterday) / avgSecondsYesterday) * 100
        : avgSecondsToday > 0
        ? 100 // If yesterday had 0 duration and today has duration, it's 100% increase
        : 0; // If both are 0, no change

    // Calculate success rate change (this month vs last month)
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
    const allCallsLastMonth = await this.callModel.find({
      createdAt: { $gte: lastMonthStart, $lt: lastMonthEnd },
    });
    const successRateLastMonth = calculateSuccessRate(allCallsLastMonth);
    
    const successRateChange =
      successRateLastMonth > 0
        ? successRateThisMonth - successRateLastMonth
        : successRateThisMonth > 0
        ? successRateThisMonth // If last month had 0% and this month has a rate, use this month's rate as change
        : 0; // If both are 0, no change

    return {
      totalCallsToday,
      activeAgents,
      activeCallsCount: activeCalls.length,
      avgCallDuration: avgDuration,
      successRate: Math.round(successRateThisMonth * 10) / 10, // Use monthly success rate
      callsChange: Math.round(callsChange * 10) / 10,
      durationChange: Math.round(durationChange * 10) / 10,
      successRateChange: Math.round(successRateChange * 10) / 10,
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
    const contacts = await this.contactModel.find();

    // Calculate date ranges for comparisons
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastWeek = new Date(now);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Filter calls for different periods
    const callsThisMonth = calls.filter(
      (call) => call.createdAt >= thisMonthStart
    );
    const callsLastMonth = calls.filter(
      (call) =>
        call.createdAt >= lastMonthStart && call.createdAt < thisMonthStart
    );
    const callsThisWeek = calls.filter((call) => call.createdAt >= lastWeek);
    const callsLastWeek = calls.filter(
      (call) =>
        call.createdAt >= new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000) &&
        call.createdAt < lastWeek
    );

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

    // Hourly data (last 24 hours - today only)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const callsToday = calls.filter(
      (call) => call.createdAt >= today && call.createdAt < tomorrow
    );

    const hourlyData = [];
    for (let i = 0; i < 24; i++) {
      const hour = new Date(today);
      hour.setHours(i, 0, 0, 0);
      const nextHour = new Date(hour);
      nextHour.setHours(nextHour.getHours() + 1);

      const count = callsToday.filter(
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

    // Calculate Average Handle Time (AHT)
    const calculateAHT = (callList: CallDocument[]): string => {
      if (callList.length === 0) return "0:00";
      const totalSeconds = callList.reduce((sum, call) => {
        const [minutes, seconds] = call.duration.split(":").map(Number);
        return sum + (minutes * 60 + seconds);
      }, 0);
      const avgSeconds = totalSeconds / callList.length;
      const mins = Math.floor(avgSeconds / 60);
      const secs = Math.floor(avgSeconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const ahtThisMonth = calculateAHT(callsThisMonth);
    const ahtLastMonth = calculateAHT(callsLastMonth);
    const ahtThisMonthSeconds = callsThisMonth.reduce((sum, call) => {
      const [minutes, seconds] = call.duration.split(":").map(Number);
      return sum + (minutes * 60 + seconds);
    }, 0) / (callsThisMonth.length || 1);
    const ahtLastMonthSeconds = callsLastMonth.reduce((sum, call) => {
      const [minutes, seconds] = call.duration.split(":").map(Number);
      return sum + (minutes * 60 + seconds);
    }, 0) / (callsLastMonth.length || 1);
    const ahtChange =
      ahtLastMonthSeconds > 0
        ? ((ahtThisMonthSeconds - ahtLastMonthSeconds) / ahtLastMonthSeconds) * 100
        : ahtThisMonthSeconds > 0
        ? -100
        : 0;

    // Calculate Resolution Rate (successful calls / total calls)
    const calculateResolutionRate = (callList: CallDocument[]): number => {
      if (callList.length === 0) return 0;
      const resolved = callList.filter(
        (call) => call.outcome === "success" || call.status === "completed"
      ).length;
      return (resolved / callList.length) * 100;
    };

    const resolutionRateThisMonth = calculateResolutionRate(callsThisMonth);
    const resolutionRateLastMonth = calculateResolutionRate(callsLastMonth);
    const resolutionRateChange = resolutionRateThisMonth - resolutionRateLastMonth;

    // Unique Contacts
    const uniqueContacts = new Set(contacts.map((c) => c.phone || c.email)).size;
    const uniqueContactsThisWeek = new Set(
      contacts
        .filter((c) => c.createdAt >= lastWeek)
        .map((c) => c.phone || c.email)
    ).size;
    const uniqueContactsLastWeek = new Set(
      contacts
        .filter(
          (c) =>
            c.createdAt >= new Date(lastWeek.getTime() - 7 * 24 * 60 * 60 * 1000) &&
            c.createdAt < lastWeek
        )
        .map((c) => c.phone || c.email)
    ).size;
    const uniqueContactsChange = uniqueContactsThisWeek - uniqueContactsLastWeek;

    // Total calls change (this month vs last month)
    const totalCallsThisMonth = callsThisMonth.length;
    const totalCallsLastMonth = callsLastMonth.length;
    const totalCallsChange =
      totalCallsLastMonth > 0
        ? ((totalCallsThisMonth - totalCallsLastMonth) / totalCallsLastMonth) * 100
        : totalCallsThisMonth > 0
        ? 100
        : 0;

    // Agent performance
    const agentPerformance = agents.map((agent) => {
      const agentId = agent._id.toString();
      const agentCalls = calls.filter(
        (call) =>
          call.agentId?.toString() === agentId || call.agent === agent.name
      );
      const successfulCalls = agentCalls.filter(
        (call) => call.outcome === "success"
      ).length;
      const successRate =
        agentCalls.length > 0
          ? (successfulCalls / agentCalls.length) * 100
          : 0;

      return {
        name: agent.name,
        calls: agentCalls.length,
        success: Math.round(successRate * 10) / 10,
      };
    });

    // Call type data with percentages
    const totalCalls = calls.length;
    const inbound = calls.filter((c) => c.type === "inbound").length;
    const outbound = calls.filter((c) => c.type === "outbound").length;
    const missed = calls.filter((c) => c.type === "missed").length;

    const callTypeData = [
      {
        name: "Inbound",
        value: totalCalls > 0 ? Math.round((inbound / totalCalls) * 100) : 0,
        color: "#3b82f6",
      },
      {
        name: "Outbound",
        value: totalCalls > 0 ? Math.round((outbound / totalCalls) * 100) : 0,
        color: "#10b981",
      },
      {
        name: "Missed",
        value: totalCalls > 0 ? Math.round((missed / totalCalls) * 100) : 0,
        color: "#ef4444",
      },
    ];

    return {
      callVolume,
      hourlyData,
      agentPerformance,
      callTypeData,
      // New metrics
      avgHandleTime: ahtThisMonth,
      avgHandleTimeChange: Math.round(ahtChange * 10) / 10,
      resolutionRate: Math.round(resolutionRateThisMonth * 10) / 10,
      resolutionRateChange: Math.round(resolutionRateChange * 10) / 10,
      uniqueContacts,
      uniqueContactsChange,
      totalCallsChange: Math.round(totalCallsChange * 10) / 10,
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

