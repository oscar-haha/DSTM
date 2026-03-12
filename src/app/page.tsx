import CalendarClient from '@/components/CalendarClient';
import { listEvents } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function HomePage() {
  const events = await listEvents();

  return (
    <main className="px-5 py-10 md:px-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="chip">No login · UK time</p>
              <h1 className="font-display text-4xl md:text-5xl">Group Calendar</h1>
            </div>
            <p className="text-sm text-ink/70">All times shown in UK time.</p>
          </div>
          <p className="max-w-2xl text-base text-ink/80">
            A fast, shareable calendar for your WhatsApp group. Add events in seconds, share the link, and
            track who&apos;s going.
          </p>
        </header>

        <CalendarClient initialEvents={events} />
      </div>
    </main>
  );
}
