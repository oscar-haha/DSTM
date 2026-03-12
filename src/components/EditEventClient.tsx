'use client';

import { useState } from 'react';
import type { Event } from '@/lib/types';

export default function EditEventClient({ event, token }: { event: Event; token: string }) {
  const [form, setForm] = useState(() => {
    const [date, time] = event.startsAtLocal.split('T');
    return {
      title: event.title,
      date,
      time,
      location: event.location,
      ticketUrl: event.ticketUrl ?? '',
      notes: event.notes ?? ''
    };
  });
  const [status, setStatus] = useState<string | null>(null);

  const handleChange = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setStatus(null);
    const response = await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        title: form.title,
        date: form.date,
        time: form.time,
        location: form.location,
        ticketUrl: form.ticketUrl,
        notes: form.notes
      })
    });

    if (!response.ok) {
      setStatus('Could not update event.');
      return;
    }

    setStatus('Event updated.');
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm('Delete this event? This cannot be undone.');
    if (!confirmDelete) {
      return;
    }

    const response = await fetch(`/api/events/${event.id}?token=${token}`, { method: 'DELETE' });
    if (!response.ok) {
      setStatus('Could not delete event.');
      return;
    }

    window.location.href = '/';
  };

  return (
    <div className="card p-6">
      <h1 className="font-display text-2xl">Edit event</h1>
      <div className="mt-4 flex flex-col gap-3">
        <input
          className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
          value={form.title}
          onChange={(event) => handleChange('title', event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <input
            className="rounded-xl border border-stone bg-white/80 px-4 py-2"
            type="date"
            value={form.date}
            onChange={(event) => handleChange('date', event.target.value)}
          />
          <input
            className="rounded-xl border border-stone bg-white/80 px-4 py-2"
            type="time"
            value={form.time}
            onChange={(event) => handleChange('time', event.target.value)}
          />
        </div>
        <input
          className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
          value={form.location}
          onChange={(event) => handleChange('location', event.target.value)}
        />
        <input
          className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
          value={form.ticketUrl}
          onChange={(event) => handleChange('ticketUrl', event.target.value)}
          placeholder="Ticket link"
        />
        <textarea
          className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
          rows={3}
          value={form.notes}
          onChange={(event) => handleChange('notes', event.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button className="btn-accent" type="button" onClick={handleSave}>
            Save changes
          </button>
          <button className="btn-ghost" type="button" onClick={handleDelete}>
            Delete event
          </button>
        </div>
      </div>

      {status ? <p className="mt-3 text-sm text-emerald-700">{status}</p> : null}
    </div>
  );
}
