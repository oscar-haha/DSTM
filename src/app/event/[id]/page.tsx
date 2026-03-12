import type { Metadata } from 'next';
import Link from 'next/link';
import { promises as fs } from 'fs';
import path from 'path';
import { formatOgDescription } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function loadFromFile(id: string) {
  const dataPath = process.env.DATA_PATH || path.join(process.cwd(), '.data', 'group-calendar.json');
  const raw = await fs.readFile(dataPath, 'utf-8');
  const parsed = JSON.parse(raw) as {
    events?: {
      id: string;
      title: string;
      startsAtLocal: string;
      location: string;
      ticketUrl?: string;
      notes?: string;
      goingCount: number;
    }[];
  };
  return parsed.events?.find((e) => e.id === id) ?? null;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const event = await loadFromFile(params.id).catch(() => null);
  if (!event) {
    return { title: 'Event not found' };
  }
  const description = formatOgDescription(event.startsAtLocal, event.location, event.goingCount);
  const ogImage = `/api/og/${event.id}?v=${event.goingCount}`;

  return {
    title: `${event.title} · Group Calendar`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: 'website',
      url: `/event/${event.id}`,
      images: [{ url: ogImage, width: 1200, height: 630 }]
    },
    twitter: {
      card: 'summary_large_image',
      title: event.title,
      description,
      images: [ogImage]
    }
  };
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const event = await loadFromFile(params.id).catch(() => null);
  if (!event) {
    return (
      <main className="px-5 py-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-3xl">Event not found</h1>
          <Link href="/" className="btn-ghost mt-4 inline-flex">
            Back to calendar
          </Link>
        </div>
      </main>
    );
  }

  const target = `/?event=${event.id}`;

  return (
    <html>
      <head>
        <meta httpEquiv="refresh" content={`0;url=${target}`} />
      </head>
      <body>
        <main className="px-5 py-12">
          <div className="mx-auto max-w-3xl space-y-4">
            <h1 className="font-display text-3xl">Opening event…</h1>
            <p className="text-sm text-ink/70">If you are not redirected, click below.</p>
            <Link href={target} className="btn-ghost inline-flex">
              Go to calendar
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
