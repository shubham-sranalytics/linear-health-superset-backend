import { Controller, Get, Param, Post } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Main application controller that handles HTTP requests
 * for the Superset guest token service.
 *
 * This controller exposes endpoints for health checks and
 * generating guest tokens for embedding Superset dashboards.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Hardcoded user object used for generating guest tokens.
   * In production, this should be replaced with actual user
   * authentication and authorization logic.
   *
   * @remarks
   * - username: Identifier for the user in Superset
   * - first_name/last_name: User's display name
   * - user_type: Role designation (ADMIN grants full access)
   * - organisation_id: Organization identifier for row-level security
   * - locations: Pipe-separated (|||) string of location IDs
   */
  private readonly user: User = {
    username: 'admin',
    first_name: 'Admin',
    last_name: 'User',
    user_type: 'ADMIN',
    organisation_id: 1,
    locations: '1|||2',
  };

  /**
   * Health check endpoint to verify the service is running.
   *
   * @returns {string} Simple greeting message
   *
   * @example
   * GET /
   * Response: "Hello World"
   */
  @Get('/')
  getHello(): string {
    return 'Hello World';
  }

  /**
   * Generates a guest token for embedding Superset dashboards.
   *
   * This endpoint initiates the authentication flow with Superset
   * and returns a guest token that can be used to embed dashboards
   * with appropriate row-level security rules applied.
   *
   * @returns {Promise<TokenResponse>} Object containing the guest token or error
   *
   * @example
   * POST /
   * Success Response:
   * {
   *   "status": "success",
   *   "token": "eyJ0eXAiOiJKV1QiLCJhbGciOi..."
   * }
   *
   * Error Response:
   * {
   *   "status": "failure",
   *   "error": "Connection timeout to Superset"
   * }
   *
   * @throws {Error} When Superset authentication fails or network errors occur
   */
  @Post(['/', '/:name'])
  async getGuestToken(@Param('name') name: TReqName = 'default'): Promise<TokenResponse> {
    try {
      if (!['default', 'messaging', 'messaging-error', 'assessment', 'assessment-error', 'task', 'error'].includes(name)) throw new Error(`404 not found token for ${name}`);

      const token = await this.appService.getGuestToken(this.user, name);
      return { status: 'success', token };
    } catch (error) {
      // Return a structured error response
      return {
        status: 'failure' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
