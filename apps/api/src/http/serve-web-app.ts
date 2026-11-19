import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';

interface PageRequest {
  method: string;
  path: string;
}

interface PageResponse {
  sendFile(absolutePath: string): void;
}

function isPageRequest(request: PageRequest): boolean {
  const isForTheServer = request.path.startsWith('/api/') || request.path === '/health';
  // A path with an extension asks for a file. If that file existed it was already served,
  // so what is left is a missing asset, which must be a 404 and not the app's HTML.
  return request.method === 'GET' && !isForTheServer && extname(request.path) === '';
}

/**
 * Serves the built React app from the same origin as the API: its files as themselves,
 * and index.html for every page address, so a deep link or a refresh of /employees/42
 * loads the app, which then shows that page. Returns false when there is no build to serve.
 */
export function serveWebApp(app: NestExpressApplication, webDistPath: string): boolean {
  const root = resolve(webDistPath);
  const indexHtml = join(root, 'index.html');
  if (!existsSync(indexHtml)) {
    return false;
  }

  app.useStaticAssets(root);
  app.use((request: PageRequest, response: PageResponse, next: () => void) => {
    if (isPageRequest(request)) {
      response.sendFile(indexHtml);
    } else {
      next();
    }
  });
  return true;
}
