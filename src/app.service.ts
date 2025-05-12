import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';

@Injectable()
export class AppService {
  private readonly supersetConfig: SUPERSET_CONFIG | undefined;
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.supersetConfig = this.configService.get<SUPERSET_CONFIG>('superset');
  }

  async getGuestToken(user: User): Promise<string> {
    const { access_token } = await this.fetchAccessToken();
    const { result: csrf_token, session } = await this.fetchCSRFToken(access_token);
    const rls = this.getRLS(user);
    const data = await this.fetchGuestToken(access_token, csrf_token, session, '30ddf642-4c36-40ee-ade2-fc77e6285a6c', rls, user);
    return data.token;
  }

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
    return { ...response.data, session: response.headers['set-cookie'] } as FetchCSRFTokenResponse;
  }

  async fetchAccessToken(): Promise<FetchAccessTokenResponse> {
    const response = await this.httpService.axiosRef
      .post(
        `${this.supersetConfig?.url}/api/v1/security/login`,
        {
          username: this.supersetConfig?.username,
          password: this.supersetConfig?.password,
          provider: 'db',
          refresh: true,
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
          rls,
          user,
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

  getRLS(user: User): RLS {
    const decodedUser: DecodedUser = {
      ...user,
      locations: user.locations.split('|||').map((location) => parseInt(location, 10)),
    };

    return [
      {
        clause: `organisation_id IN (${user.user_type !== 'ADMIN' ? decodedUser.organisation_id : ''})`,
      },
      {
        clause: `practice_location_id IN (${decodedUser.locations.join(',')})`,
      },
    ].filter((clause) => clause.clause !== 'organisation_id IN ()' && clause.clause !== 'practice_location_id IN ()');
  }
}
