import { NextRequest, NextResponse } from 'next/server';
import { addRsvp, removeRsvp } from '@/lib/store';
import { rateLimit } from '@/lib/rateLimit';

export const runtime = 'nodejs';

function getIp(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? null;
}

export async function POST(request: NextRequest, context: { params: any }) {
  const { id } = await context.params;
  const ip = getIp(request);
  if (ip) {
    const limit = rateLimit(`rsvp:${ip}`, 30, 60 * 60 * 1000);
    if (!limit.ok) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
  }

  const body = (await request.json()) as { nickname?: string; allowDuplicate?: boolean };
  if (!body.nickname) {
    return NextResponse.json({ error: 'missing_nickname' }, { status: 400 });
  }

  const result = await addRsvp(id, body.nickname, body.allowDuplicate ?? false);
  if (!result.ok) {
    const status = result.reason === 'duplicate' ? 409 : 400;
    return NextResponse.json({ error: result.reason, goingCount: result.goingCount }, { status });
  }

  return NextResponse.json({ rsvp: result.rsvp, goingCount: result.goingCount });
}

export async function DELETE(request: NextRequest, context: { params: any }) {
  const { id } = await context.params;
  const body = (await request.json()) as { removalToken?: string };
  if (!body.removalToken) {
    return NextResponse.json({ error: 'missing_token' }, { status: 400 });
  }

  const result = await removeRsvp(id, body.removalToken);
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 404 });
  }

  return NextResponse.json({ ok: true, goingCount: result.goingCount });
}
