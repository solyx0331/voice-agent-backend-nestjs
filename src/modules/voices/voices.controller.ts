import { Controller, Get } from "@nestjs/common";
import { RetellService } from "../../services/retell.service";

@Controller("voices")
export class VoicesController {
  constructor(private readonly retellService: RetellService) {}

  @Get()
  async getAvailableVoices() {
    const voices = await this.retellService.listAvailableVoices();
    return voices;
  }
}

