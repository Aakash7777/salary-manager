import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../app.module.js';
import type { AppDatabase } from '../db/database.js';
import { DATABASE } from '../db/database.module.js';
import { serveWebApp } from './serve-web-app.js';

const INDEX_HTML = '<!doctype html><html><body><div id="root">built web app</div></body></html>';

describe('HTTP: health check and the built web app', () => {
  const originalDatabasePath = process.env.DATABASE_PATH;
  let app: NestExpressApplication;
  let webDist: string;
  const http = () => request(app.getHttpServer());

  beforeEach(async () => {
    // A stand-in for apps/web/dist: an index page and one hashed asset.
    webDist = mkdtempSync(join(tmpdir(), 'salary-manager-web-'));
    mkdirSync(join(webDist, 'assets'));
    writeFileSync(join(webDist, 'index.html'), INDEX_HTML);
    writeFileSync(join(webDist, 'assets', 'index-abc123.js'), 'console.log("app");');

    process.env.DATABASE_PATH = ':memory:';
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    app.useLogger(false);
    serveWebApp(app, webDist);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    rmSync(webDist, { recursive: true, force: true });
    if (originalDatabasePath === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = originalDatabasePath;
    }
  });

  describe('GET /health', () => {
    it('answers ok, outside /api, after really querying the database', async () => {
      const response = await http().get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ status: 'ok', db: 'ok' });
    });

    it('answers 503 when the database cannot be queried', async () => {
      app.get<AppDatabase>(DATABASE).$client.close();

      const response = await http().get('/health');

      expect(response.status).toBe(503);
      expect(response.body).toEqual({ status: 'error', db: 'error' });
    });

    it('is not also served under /api', async () => {
      const response = await http().get('/api/health');

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    });
  });

  describe('the built web app', () => {
    it('serves index.html at /', async () => {
      const response = await http().get('/');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.text).toBe(INDEX_HTML);
    });

    it.each(['/employees', '/employees/42', '/insights', '/insights/IN', '/some/unknown/page'])(
      'serves index.html for the client-side route %s, so a deep link or a refresh works',
      async (path) => {
        const response = await http().get(path);

        expect(response.status).toBe(200);
        expect(response.text).toBe(INDEX_HTML);
      },
    );

    it('keeps the query string out of the way: a filtered directory link still gets the app', async () => {
      const response = await http().get('/employees?country=IN&sort=salary');

      expect(response.status).toBe(200);
      expect(response.text).toBe(INDEX_HTML);
    });

    it('serves a built asset as itself, with a JavaScript content type', async () => {
      const response = await http().get('/assets/index-abc123.js');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('javascript');
      expect(response.text).toBe('console.log("app");');
    });

    it('answers 404 for a missing asset instead of handing back index.html', async () => {
      const response = await http().get('/assets/index-missing.js');

      expect(response.status).toBe(404);
      expect(response.text).not.toContain('built web app');
    });

    it('still answers an unknown /api route with the JSON 404, not the web app', async () => {
      const response = await http().get('/api/nope');

      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toEqual({
        error: { code: 'NOT_FOUND', message: expect.any(String) as string },
      });
    });

    it('still serves the real API alongside the web app', async () => {
      const response = await http().get('/api/meta');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ departments: [], jobTitles: [] });
    });

    it('does not answer a POST to a page address with the web app', async () => {
      const response = await http().post('/employees').send({});

      expect(response.status).toBe(404);
      expect(response.text).not.toContain('built web app');
    });
  });
});
