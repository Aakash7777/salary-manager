import { createReadStream, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { buildOpenApiDocument } from './openapi.js';

// The folder of the swagger-ui-dist package, whose built files are served as they are.
const SWAGGER_UI_FOLDER = dirname(createRequire(import.meta.url).resolve('swagger-ui-dist'));

/** The only files of that package this API hands out. */
const ASSET_TYPES = new Map([
  ['swagger-ui.css', 'text/css; charset=utf-8'],
  ['swagger-ui-bundle.js', 'text/javascript; charset=utf-8'],
  ['favicon-32x32.png', 'image/png'],
]);

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ACME Salary Manager API</title>
    <link rel="icon" type="image/png" href="/api/docs/assets/favicon-32x32.png" />
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger-ui' });
    </script>
  </body>
</html>
`;

@Controller('api/docs')
export class DocsController {
  private readonly document = buildOpenApiDocument();

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  page(): string {
    return PAGE;
  }

  @Get('openapi.json')
  openApi(): Record<string, unknown> {
    return this.document;
  }

  @Get('assets/:file')
  asset(@Param('file') file: string): StreamableFile {
    const type = ASSET_TYPES.get(file);
    if (type === undefined) {
      throw new NotFoundException(`No documentation asset named ${file}`);
    }
    const path = join(SWAGGER_UI_FOLDER, file);
    return new StreamableFile(createReadStream(path), { type, length: statSync(path).size });
  }
}
