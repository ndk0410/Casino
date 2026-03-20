import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

type Params = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(_request: NextRequest, context: Params) {
  const { slug } = await context.params;
  const normalizedSlug = slug.replace(/\.html$/i, '');
  const filePath = path.join(
    process.cwd(),
    'public',
    'pages',
    `${normalizedSlug}.html`
  );

  try {
    const html = await readFile(filePath, 'utf8');
    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, max-age=0, must-revalidate',
      },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}
