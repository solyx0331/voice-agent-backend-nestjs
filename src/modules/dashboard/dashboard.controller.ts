import { Controller, Get } from "@nestjs/common";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("stats")
  async getDashboardStats() {
    return this.dashboardService.getDashboardStats();
  }

  @Get("agents")
  async getVoiceAgents() {
    console.log("getVoiceAgents ==> ", await this.dashboardService.getVoiceAgents());
    return this.dashboardService.getVoiceAgents();
  }

  @Get("analytics")
  async getAnalyticsData() {
    return this.dashboardService.getAnalyticsData();
  }

  @Get("live-call")
  async getLiveCall() {
    return this.dashboardService.getLiveCall();
  }

  @Get("live-calls")
  async getLiveCalls() {
    return this.dashboardService.getLiveCalls();
  }
}

