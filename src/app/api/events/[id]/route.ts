import { NextRequest, NextResponse } from 'next/server';
import { deleteEvent, getEvent, reportEvent, updateEvent } from '@/lib/store';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

function getIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? null;
}

export async function GET(_request: NextRequest, context: { params: any }) {
  const { id } = await context.params;
  const data = await getEvent(id);
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, context: { params: any }) {
  const { id } = await context.params;
  const body = (await request.json()) as {
    token?: string;
    title?: string;
    date?: string;
    time?: string;
    location?: string;
    ticketUrl?: string;
    notes?: string;
  };

  if (!body.token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 403 });
  }

  const startsAtLocal = body.date && body.time ? `${body.date}T${body.time}` : undefined;

  const result = await updateEvent(id, body.token, {
    title: body.title?.trim(),
    startsAtLocal,
    location: body.location?.trim(),
    ticketUrl: body.ticketUrl?.trim() || undefined,
    notes: body.notes?.trim() || undefined
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 403 });
  }

  return NextResponse.json({ event: result.event });
}

export async function DELETE(request: NextRequest, context: { params: any }) {
  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'missing_token' }, { status: 403 });
  }

  const result = await deleteEvent(id, token);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest, context: { params: any }) {
  const { id } = await context.params;
  const ip = getIp(request);
  if (ip) {
    const limit = rateLimit(`report:${ip}`, 10, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
  }

  const body = (await request.json()) as { reason?: string };
  await reportEvent(id, body.reason ?? 'No reason provided');
  return NextResponse.json({ ok: true });
}
