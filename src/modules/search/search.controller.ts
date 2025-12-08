import { Controller, Get, Query } from "@nestjs/common";
import { SearchService } from "./search.service";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async searchGlobal(@Query("q") query: string) {
    if (!query) {
      return { agents: [], calls: [], contacts: [] };
    }
    return this.searchService.searchGlobal(query);
  }
}

