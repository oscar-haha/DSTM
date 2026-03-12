'use client';

import { useEffect, useState } from 'react';
import type { Event, RSVP } from '@/lib/types';
import Link from 'next/link';

export default function EventClient({ event, rsvps }: { event: Event; rsvps: RSVP[] }) {
  const [nickname, setNickname] = useState('');
  const [items, setItems] = useState<RSVP[]>(rsvps);
  const [goingCount, setGoingCount] = useState(event.goingCount);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [removalToken, setRemovalToken] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const savedEdit = localStorage.getItem(`editToken:${event.id}`);
    const savedRemoval = localStorage.getItem(`rsvpToken:${event.id}`);
    setEditToken(savedEdit);
    setRemovalToken(savedRemoval);
  }, [event.id]);

  const refresh = async () => {
    const response = await fetch(`/api/events/${event.id}`);
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { rsvps: RSVP[]; event: Event };
    setItems(data.rsvps);
    setGoingCount(data.event.goingCount);
  };

  const handleRsvp = async (allowDuplicate = false) => {
    setStatus(null);
    if (!nickname.trim()) {
      setStatus('Enter a nickname to RSVP.');
      return;
    }

    const response = await fetch(`/api/events/${event.id}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, allowDuplicate })
    });

    if (response.status === 409) {
      const proceed = window.confirm('That nickname already exists. Add anyway?');
      if (proceed) {
        await handleRsvp(true);
      }
      return;
    }

    if (!response.ok) {
      setStatus('Could not add RSVP.');
      return;
    }

    const data = (await response.json()) as { rsvp: RSVP; goingCount: number };
    localStorage.setItem(`rsvpToken:${event.id}`, data.rsvp.removalToken);
    setRemovalToken(data.rsvp.removalToken);
    setItems((prev) => [...prev, data.rsvp]);
    setGoingCount(data.goingCount);
    setNickname('');
  };

  const handleRemove = async () => {
    if (!removalToken) {
      return;
    }
    const response = await fetch(`/api/events/${event.id}/rsvp`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removalToken })
    });
    if (!response.ok) {
      setStatus('Could not remove RSVP.');
      return;
    }

    localStorage.removeItem(`rsvpToken:${event.id}`);
    setRemovalToken(null);
    await refresh();
  };

  const handleReport = async () => {
    const reason = window.prompt('Report event (optional reason):');
    if (reason === null) {
      return;
    }
    await fetch(`/api/events/${event.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    setStatus('Report submitted.');
  };

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Who&apos;s going</h2>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span>{goingCount} going</span>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => navigator.clipboard.writeText(window.location.href)}
          >
            Copy link
          </button>
        </div>
      </div>

      {editToken ? (
        <Link href={`/event/${event.id}/edit/${editToken}`} className="mt-2 inline-flex text-sm font-semibold text-accent">
          Edit this event
        </Link>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        {items.length === 0 ? (
          <p className="text-sm text-ink/60">No one yet. Be the first.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border border-stone bg-white/70 px-3 py-2">
              <span>{item.nickname}</span>
              <span className="text-xs text-ink/50">Joined</span>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
            placeholder="Your nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
          <button className="btn-accent" type="button" onClick={() => handleRsvp()}>
            I&apos;m going
          </button>
        </div>
        {removalToken ? (
          <button className="btn-ghost w-fit" type="button" onClick={handleRemove}>
            Remove my RSVP
          </button>
        ) : null}
      </div>

      <button className="mt-4 text-xs text-ink/50 underline" type="button" onClick={handleReport}>
        Report this event
      </button>

      {status ? <p className="mt-2 text-sm text-emerald-700">{status}</p> : null}
    </section>
  );
}
