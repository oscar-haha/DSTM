import { ImageResponse } from 'next/og';
import { getEvent } from '@/lib/store';
import { formatUkDateTime } from '@/lib/format';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: { id: string } }) {
  const data = await getEvent(context.params.id);
  if (!data) {
    return new Response('Not found', { status: 404 });
  }

  const { event } = data;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '56px',
          background: 'linear-gradient(135deg, #f8f5ef 0%, #efe4d6 55%, #f2b56b 100%)',
          color: '#1c1a17',
          fontFamily: 'serif'
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.1 }}>{event.title}</div>
        <div style={{ fontSize: 36, fontWeight: 600 }}>{formatUkDateTime(event.startsAtLocal)}</div>
        <div style={{ fontSize: 28 }}>{event.location}</div>
        <div style={{ fontSize: 32, fontWeight: 700 }}>{event.goingCount} going</div>
        <div style={{ fontSize: 24, opacity: 0.8 }}>Group Calendar · UK time</div>
      </div>
    ),
    {
      width: 1200,
      height: 630
    }
  );
}
