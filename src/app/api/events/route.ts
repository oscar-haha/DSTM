import { NextRequest, NextResponse } from 'next/server';
import { createEvent, listEvents } from '@/lib/store';
import { rateLimit } from '@/lib/rateLimit';
import { verifyTurnstile } from '@/lib/turnstile';

export const runtime = 'nodejs';

function getIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? null;
}

export async function GET() {
  const events = await listEvents();
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const ip = getIp(request);
  if (ip) {
    const limit = rateLimit(`create:${ip}`, 6, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
  }

  const body = (await request.json()) as {
    title?: string;
    date?: string;
    time?: string;
    location?: string;
    ticketUrl?: string;
    notes?: string;
    turnstileToken?: string;
  };

  const { title, date, time, location, ticketUrl, notes, turnstileToken } = body;

  if (!title || !date || !ticketUrl) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }

  const verification = await verifyTurnstile(turnstileToken ?? null, ip);
  if (!verification.ok) {
    return NextResponse.json({ error: 'captcha_failed' }, { status: 403 });
  }

  const startsAtLocal = `${date}T${time || '22:00'}`;

  const result = await createEvent({
    title: title.trim(),
    startsAtLocal,
    location: location?.trim(),
    ticketUrl: ticketUrl?.trim(),
    notes: notes?.trim() || undefined
  });

  return NextResponse.json({ event: result.event, editToken: result.editToken });
}
