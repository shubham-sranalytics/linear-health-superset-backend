import { Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  private readonly user: User = {
    username: 'admin',
    first_name: 'Admin',
    last_name: 'User',
    user_type: 'ADMIN',
    organisation_id: 1,
    locations: '1|||2',
  };

  @Get('/')
  getHello(): string {
    return 'Hello World';
  }

  @Post('/')
  async getGuestToken(): Promise<TokenResponse> {
    try {
      const token = await this.appService.getGuestToken(this.user);
      return { status: 'success', token };
    } catch (error) {
      return {
        status: 'failure' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
