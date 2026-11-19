import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';

interface Operation {
  summary?: string;
  parameters?: { name: string; in: string }[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
}

interface OpenApiDocument {
  openapi: string;
  info: { title: string };
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown>; responses: Record<string, unknown> };
}

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

/** Every route the running application answers, as "METHOD /path/{param}". */
function registeredRoutes(app: NestExpressApplication): string[] {
  const express = app.getHttpAdapter().getInstance() as { router: { stack: RouteLayer[] } };
  return express.router.stack
    .flatMap((layer) => {
      const route = layer.route;
      if (!route) return [];
      const path = route.path.replace(/:(\w+)/g, '{$1}');
      return Object.keys(route.methods).map((method) => `${method.toUpperCase()} ${path}`);
    })
    .sort();
}

function documentedRoutes(document: OpenApiDocument): string[] {
  return Object.entries(document.paths)
    .flatMap(([path, operations]) =>
      Object.keys(operations).map((method) => `${method.toUpperCase()} ${path}`),
    )
    .sort();
}

/** Every "$ref" value anywhere in the document. */
function referencesIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(referencesIn);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    key === '$ref' && typeof child === 'string' ? [child] : referencesIn(child),
  );
}

describe('HTTP API documentation', () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  let app: NestExpressApplication;
  const http = () => request(app.getHttpServer());

  async function openApiDocument(): Promise<OpenApiDocument> {
    const response = await http().get('/api/docs/openapi.json');
    expect(response.status).toBe(200);
    return response.body as OpenApiDocument;
  }

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useLogger(false);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }
  });

  describe('the Swagger UI page', () => {
    it('GET /api/docs serves an HTML page that loads Swagger UI with this API’s document', async () => {
      const response = await http().get('/api/docs');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toContain('id="swagger-ui"');
      expect(response.text).toContain('/api/docs/assets/swagger-ui-bundle.js');
      expect(response.text).toContain('/api/docs/assets/swagger-ui.css');
      expect(response.text).toContain('/api/docs/openapi.json');
    });

    it.each([
      { file: 'swagger-ui.css', contentType: 'text/css' },
      { file: 'swagger-ui-bundle.js', contentType: 'javascript' },
    ])('serves its own copy of $file, so the page works without internet access', async (asset) => {
      const response = await http().get(`/api/docs/assets/${asset.file}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain(asset.contentType);
      expect(Number(response.headers['content-length'] ?? response.text.length)).toBeGreaterThan(
        1_000,
      );
    });

    it.each(['package.json', 'nope.js', '..%2F..%2Fpackage.json'])(
      'does not serve "%s", which is not one of the page’s assets',
      async (file) => {
        const response = await http().get(`/api/docs/assets/${file}`);

        expect(response.status).toBe(404);
        expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
      },
    );
  });

  describe('the OpenAPI document', () => {
    it('is OpenAPI 3.1 and names the API', async () => {
      const document = await openApiDocument();

      expect(document.openapi).toBe('3.1.0');
      expect(document.info.title).toBe('ACME Salary Manager API');
    });

    it('documents every route the application has, and no route it does not have', async () => {
      const document = await openApiDocument();
      // The documentation's own three routes are not part of the API it describes.
      const apiRoutes = registeredRoutes(app).filter((route) => !route.includes('/api/docs'));

      expect(apiRoutes).toHaveLength(12);
      expect(documentedRoutes(document)).toEqual(apiRoutes);
    });

    it('gives every operation a summary, a success response and the standard error for a failure', async () => {
      const document = await openApiDocument();

      const incomplete = Object.entries(document.paths).flatMap(([path, operations]) =>
        Object.entries(operations)
          .filter(([, operation]) => {
            const statuses = Object.keys(operation.responses);
            return !(
              operation.summary &&
              statuses.some((status) => status.startsWith('2')) &&
              statuses.includes('500')
            );
          })
          .map(([method]) => `${method.toUpperCase()} ${path}`),
      );

      expect(incomplete).toEqual([]);
    });

    it('only refers to schemas and responses that it defines', async () => {
      const document = await openApiDocument();
      const defined = new Set([
        ...Object.keys(document.components.schemas).map((name) => `#/components/schemas/${name}`),
        ...Object.keys(document.components.responses).map(
          (name) => `#/components/responses/${name}`,
        ),
      ]);

      const references = referencesIn(document);

      expect(references.length).toBeGreaterThan(20);
      expect(references.filter((reference) => !defined.has(reference))).toEqual([]);
    });

    it('takes the request bodies from the shared zod schemas', async () => {
      const document = await openApiDocument();

      expect(document.components.schemas.CreateEmployeeInput).toMatchObject({
        required: expect.arrayContaining(['fullName', 'salaryMajor', 'hireDate']) as string[],
        additionalProperties: false,
        properties: {
          employmentType: { enum: ['FULL_TIME', 'PART_TIME', 'CONTRACTOR'] },
          fullName: { maxLength: 200 },
        },
      });
      expect(document.components.schemas.ChangeSalaryInput).toMatchObject({
        properties: { reason: { minLength: 3, maxLength: 500 } },
      });
      expect(document.paths['/api/employees']?.post?.requestBody).toMatchObject({
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/CreateEmployeeInput' } },
        },
      });
    });

    it('lists the directory’s query parameters, and leaves paging out of the CSV export', async () => {
      const document = await openApiDocument();
      const names = (operation: Operation | undefined) =>
        (operation?.parameters ?? []).filter((p) => p.in === 'query').map((p) => p.name);

      expect(names(document.paths['/api/employees']?.get)).toEqual([
        'search',
        'country',
        'department',
        'jobTitle',
        'sort',
        'order',
        'page',
        'pageSize',
      ]);
      expect(names(document.paths['/api/employees/export.csv']?.get)).toEqual([
        'search',
        'country',
        'department',
        'jobTitle',
        'sort',
        'order',
      ]);
    });

    it('documents the error body with its code, message and optional field list', async () => {
      const document = await openApiDocument();

      expect(document.components.schemas.Error).toMatchObject({
        required: ['error'],
        properties: {
          error: {
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              fields: { type: 'array' },
            },
          },
        },
      });
    });

    it('documents the statuses each write can answer with', async () => {
      const document = await openApiDocument();
      const statuses = (path: string, method: string) =>
        Object.keys(document.paths[path]?.[method]?.responses ?? {}).sort();

      expect(statuses('/api/employees', 'post')).toEqual(['201', '400', '409', '500']);
      expect(statuses('/api/employees/{id}', 'patch')).toEqual(['200', '400', '404', '409', '500']);
      expect(statuses('/api/employees/{id}', 'delete')).toEqual(['204', '400', '404', '500']);
      expect(statuses('/api/employees/{id}/salary-changes', 'post')).toEqual([
        '201',
        '400',
        '404',
        '500',
      ]);
      expect(statuses('/health', 'get')).toEqual(['200', '500', '503']);
    });
  });
});
