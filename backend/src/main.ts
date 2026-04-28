import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS - allow frontend to access backend
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Academic Certificate Verification API')
    .setDescription(
      'API for blockchain-based academic document verification system (SBT) with IPFS storage',
    )
    .setVersion('1.0')
    .addTag('certificates', 'Academic certificate management')
    .addTag('ipfs', 'IPFS file upload and management')
    .addTag('blockchain', 'Smart contract interaction')
    .addTag('qrcode', 'QR Code generation')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Hello Sekai! >_<`);
  console.log(`Backend API running at: http://localhost:${port}`);
  console.log(`Swagger API Docs: http://localhost:${port}/api`);
}
bootstrap();