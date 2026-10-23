import express, { Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFound';

const app: Application = express();

// Security HTTP headers
app.use(helmet());

// Enable Cross-Origin Resource Sharing
app.use(cors());

// Parse incoming JSON requests
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve Swagger / OpenAPI Documentation at /api-docs (outside /api/v1)
try {
  const swaggerDocument = YAML.load(path.resolve(process.cwd(), 'docs/openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });
} catch (err) {
  console.warn('Could not load docs/openapi.yaml for Swagger UI:', err);
}

// Mount core business API routes under /api/v1
app.use('/api/v1', routes);

// Fallback 404 handler
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

export default app;
