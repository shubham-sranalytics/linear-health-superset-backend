import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';

/**
 * Service responsible for handling Superset authentication and guest token generation.
 *
 * This service manages the multi-step authentication flow with Apache Superset:
 * 1. Obtain an access token using admin credentials
 * 2. Fetch a CSRF token using the access token
 * 3. Generate row-level security (RLS) rules based on user attributes
 * 4. Request a guest token with the appropriate permissions
 */
@Injectable()
export class AppService {
  /** Configuration object containing Superset connection details */
  private readonly supersetConfig: SUPERSET_CONFIG | undefined;

  /** Logger instance for debugging and error tracking */
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    // Load Superset configuration from environment variables
    this.supersetConfig = this.configService.get<SUPERSET_CONFIG>('superset');
  }

  /**
   * Orchestrates the complete guest token generation process.
   *
   * This method performs the following steps:
   * 1. Fetches an access token from Superset
   * 2. Retrieves a CSRF token using the access token
   * 3. Generates RLS rules based on user attributes
   * 4. Requests a guest token with the dashboard permissions
   *
   * @param {User} user - The user object containing authentication details
   * @returns {Promise<string>} The generated guest token
   * @throws {Error} If any step in the authentication flow fails
   *
   * @example
   * const token = await appService.getGuestToken({
   *   username: 'john.doe',
   *   user_type: 'USER',
   *   organisation_id: 123,
   *   locations: '1|||2|||3'
   * });
   */
  async getGuestToken(user: User, name: TReqName): Promise<string> {
    // Step 1: Get access token using admin credentials
    const { access_token } = await this.fetchAccessToken();

    // Step 2: Get CSRF token for security
    const { result: csrf_token, session } = await this.fetchCSRFToken(access_token);

    // Step 3: Generate RLS rules based on user permissions
    const rls = this.getRLS();
    const dashboardId = this.getDashboardId(name);

    // Step 4: Get guest token with all required parameters
    // Note: Dashboard ID is hardcoded - should be configurable in production
    const data = await this.fetchGuestToken(access_token, csrf_token, session, dashboardId, rls, user);

    return data.token;
  }

  /**
   * Fetches a CSRF token from Superset.
   *
   * CSRF tokens are required for state-changing operations in Superset
   * to prevent cross-site request forgery attacks.
   *
   * @param {string} access_token - Valid access token from Superset
   * @returns {Promise<FetchCSRFTokenResponse>} Object containing CSRF token and session cookie
   * @throws {AxiosError} If the request to Superset fails
   *
   * @private
   */
  async fetchCSRFToken(access_token: string): Promise<FetchCSRFTokenResponse> {
    const response = await this.httpService.axiosRef
      .get(`${this.supersetConfig?.url}/api/v1/security/csrf_token`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${access_token}`,
        },
      })
      .catch((error: AxiosError) => {
        this.logger.error('Error fetching CSRF token:', error.response?.data || error.message);
        throw error;
      });

    this.logger.debug('CSRF token response:', response.data);

    // Return both the CSRF token and session cookie
    return {
      ...response.data,
      session: response.headers['set-cookie'],
    } as FetchCSRFTokenResponse;
  }

  /**
   * Authenticates with Superset using admin credentials.
   *
   * This method performs a login operation to obtain an access token
   * that will be used for subsequent API calls to Superset.
   *
   * @returns {Promise<FetchAccessTokenResponse>} Object containing access and refresh tokens
   * @throws {AxiosError} If authentication fails or network error occurs
   *
   * @private
   */
  async fetchAccessToken(): Promise<FetchAccessTokenResponse> {
    const response = await this.httpService.axiosRef
      .post(
        `${this.supersetConfig?.url}/api/v1/security/login`,
        {
          username: this.supersetConfig?.username,
          password: this.supersetConfig?.password,
          provider: 'db', // Database authentication provider
          refresh: true, // Request a refresh token
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      .catch((error: AxiosError) => {
        this.logger.error('Error logging in to Superset:', error.response?.data || error.message);
        throw error;
      });

    this.logger.debug('Access token response:', response.data);
    return response.data as FetchAccessTokenResponse;
  }

  /**
   * Requests a guest token from Superset with specific dashboard permissions.
   *
   * Guest tokens allow embedding Superset dashboards in external applications
   * while maintaining security through row-level security rules.
   *
   * @param {string} access_token - Valid access token
   * @param {string} csrf_token - CSRF token for request validation
   * @param {string} session - Session cookie from CSRF token request
   * @param {string} dashboard_id - UUID of the dashboard to embed
   * @param {RLS} rls - Row-level security rules to apply
   * @param {User} user - User information to embed in the token
   * @returns {Promise<FetchGuestTokenResponse>} Object containing the guest token
   * @throws {AxiosError} If the request fails
   *
   * @private
   */
  async fetchGuestToken(access_token: string, csrf_token: string, session: string, dashboard_id: string, rls: RLS, user: User): Promise<FetchGuestTokenResponse> {
    const response = await this.httpService.axiosRef
      .post(
        `${this.supersetConfig?.url}/api/v1/security/guest_token`,
        {
          resources: [
            {
              type: 'dashboard',
              id: dashboard_id,
            },
          ],
          rls, // Row-level security rules
          user, // User context for the token
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${access_token}`,
            'X-CSRFToken': csrf_token,
            Cookie: session,
          },
        },
      )
      .catch((error: AxiosError) => {
        this.logger.error('Error fetching guest token:', error.response?.data || error.message);
        throw error;
      });

    this.logger.debug('Guest token response:', response.data);
    return response.data as FetchGuestTokenResponse;
  }

  getRLS(): RLS {
    return [{ clause: 'practice_location_id IN (1,2)' }, { clause: 'organisation_id IN (1)' }];
  }

  getDashboardId(name: TReqName): string {
    if (name === 'task')
      return '07761b1b-bf0d-47fb-9416-e25ee85e2bd4'; // task dashboard
    else if (name === 'assessment')
      return '1449667a-8a39-4862-a79c-bb40117bcd6d'; // assessment dashboard
    else if (name === 'messaging')
      return '6fab7c77-4dd7-4471-97ca-b62af012b3a4'; // messaging dashboard
    else return 'bfe106ab-3219-4664-969c-2f2f96fd377a'; // referral dashboard
  }
}
