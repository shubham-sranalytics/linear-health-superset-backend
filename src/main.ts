import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { createServer, proxy } from 'aws-serverless-express';
import { Server } from 'http';

let cachedServer: Server;

async function bootstrapServer(): Promise<Server> {
  if (!cachedServer) {
    const app = await NestFactory.create(AppModule);
    app.enableCors();
    await app.init();
    cachedServer = createServer(app.getHttpAdapter().getInstance());
  }
  return cachedServer;
}

export default async function handler(req, res) {
  const server = await bootstrapServer();
  return server.emit('request', req, res);
}