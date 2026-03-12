import Link from 'next/link';
import { getEvent } from '@/lib/store';
import EditEventClient from '@/components/EditEventClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function EditEventPage({ params }: { params: { id: string; token: string } }) {
  const data = await getEvent(params.id);
  if (!data) {
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

  return (
    <main className="px-5 py-10">
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Link href={`/event/${params.id}`} className="btn-ghost w-fit">
          ← Back to event
        </Link>
        <EditEventClient event={data.event} token={params.token} />
      </div>
    </main>
  );
}
