type TokenResponse = {
  status: 'success' | 'failure';
  token?: string;
  error?: string;
};

type FetchAccessTokenResponse = {
  access_token: string;
  refresh_token: string;
};

type FetchCSRFTokenResponse = {
  result: string;
  session: string;
};

type FetchGuestTokenResponse = {
  token: string;
};

type RLS = RLSClause[];
type RLSClause = {
  clause: string;
};

type User = {
  username: string;
  first_name: string;
  last_name: string;
  organisation_id: number;
  user_type: 'USER' | 'ADMIN';
  locations: string;
  [key: string]: any;
};

type DecodedUser = Pick<User, 'organisation_id'> & { locations: number[] };
