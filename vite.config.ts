import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

const plotFile = fileURLToPath(new URL('./data/plot.json', import.meta.url));

const inline = (v: unknown): string =>
  Array.isArray(v)
    ? `[${v.map(inline).join(', ')}]`
    : v && typeof v === 'object'
      ? `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }`
      : JSON.stringify(v);

// Формат файла как у ручной правки: один объект на строку
function formatPlot(plot: Record<string, unknown>): string {
  const lines = Object.entries(plot).map(([key, value]) => {
    if (key === 'boundary') {
      const fields = Object.entries(value as Record<string, unknown>)
        .map(([k, v]) => `    ${JSON.stringify(k)}: ${inline(v)}`)
        .join(',\n');
      return `  "boundary": {\n${fields}\n  }`;
    }
    if (Array.isArray(value)) {
      const rows = value.map((o) => `    ${inline(o)}`).join(',\n');
      return `  ${JSON.stringify(key)}: [\n${rows}\n  ]`;
    }
    return `  ${JSON.stringify(key)}: ${inline(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

// Только dev: редактор в браузере сохраняет расстановку в data/plot.json
function savePlot(): Plugin {
  return {
    name: 'save-plot',
    configureServer(server) {
      server.middlewares.use('/__plot', (req, res) => {
        const sameOrigin = !req.headers.origin || req.headers.origin === `http://${req.headers.host}`;
        if (req.method !== 'POST' || !sameOrigin || req.headers['content-type'] !== 'application/json') {
          res.statusCode = 403;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', async () => {
          try {
            const plot = JSON.parse(body);
            if (!Array.isArray(plot.objects) || !plot.boundary?.points || !plot.location) throw new Error('bad plot');
            await writeFile(plotFile, formatPlot(plot));
            res.end('ok');
          } catch {
            res.statusCode = 400;
            res.end('bad request');
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [savePlot()],
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        gallery: fileURLToPath(new URL('./gallery.html', import.meta.url)),
      },
    },
  },
});
