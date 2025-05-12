import { registerAs } from '@nestjs/config';
import { IsString, IsNotEmpty, IsUrl, Matches } from 'class-validator';
import validateConfig from '../utils/validate-config';

class EnvironmentVariablesValidator {
  @IsString()
  @IsNotEmpty()
  SUPERSET_EMBEDDED_USERNAME: string;

  @IsString()
  @IsNotEmpty()
  SUPERSET_EMBEDDED_PASSWORD: string;

  @IsString()
  @IsUrl({ protocols: ['http', 'https'], require_tld: false })
  @IsNotEmpty()
  @Matches(/^.*[^\\/]$/, {
    message: 'URL should not end with a trailing slash (/)',
  })
  SUPERSET_EMBEDDED_URL: string;
}

export default registerAs<SUPERSET_CONFIG>('superset', () => {
  validateConfig(process.env, EnvironmentVariablesValidator);
  return {
    username: process.env.SUPERSET_EMBEDDED_USERNAME || '',
    password: process.env.SUPERSET_EMBEDDED_PASSWORD || '',
    url: process.env.SUPERSET_EMBEDDED_URL || '',
  };
});
