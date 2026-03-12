import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET() {
  const dataPath = process.env.DATA_PATH || path.join(process.cwd(), '.data', 'group-calendar.json');
  let exists = false;
  let size = 0;
  let eventCount = 0;
  let eventIds: string[] = [];
  let error: string | null = null;

  try {
    const stat = await fs.stat(dataPath);
    exists = true;
    size = stat.size;
    const raw = await fs.readFile(dataPath, 'utf-8');
    const parsed = JSON.parse(raw) as { events?: { id: string }[] };
    eventCount = parsed.events?.length ?? 0;
    eventIds = (parsed.events ?? []).map((event) => event.id);
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  return NextResponse.json({
    cwd: process.cwd(),
    dataPath,
    exists,
    size,
    eventCount,
    eventIds,
    nodeEnv: process.env.NODE_ENV,
    vercelUrl: process.env.VERCEL_URL ?? null,
    error
  });
}
