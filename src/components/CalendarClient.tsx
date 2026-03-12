'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Event, RSVP } from '@/lib/types';
import { formatUkDate, formatUkDateTime } from '@/lib/format';
import Script from 'next/script';
import { useSearchParams } from 'next/navigation';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

function getUkDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);

  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(lookup.year),
    month: Number(lookup.month),
    day: Number(lookup.day)
  };
}

function getUkTodayIso() {
  const { year, month, day } = getUkDateParts(new Date());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function buildMonthGrid(year: number, monthIndex: number) {
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const startDay = firstOfMonth.getUTCDay();
  const startDate = new Date(Date.UTC(year, monthIndex, 1 - startDay));
  const days: { date: Date; iso: string; inMonth: boolean }[] = [];

  for (let i = 0; i < 42; i += 1) {
    const date = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate() + i));
    const iso = date.toISOString().slice(0, 10);
    days.push({
      date,
      iso,
      inMonth: date.getUTCMonth() === monthIndex
    });
  }

  return days;
}

export default function CalendarClient({ initialEvents }: { initialEvents: Event[] }) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [selectedDate, setSelectedDate] = useState(getUkTodayIso());
  const [monthCursor, setMonthCursor] = useState(() => {
    const { year, month } = getUkDateParts(new Date());
    return { year, monthIndex: month - 1 };
  });

  const [formState, setFormState] = useState({
    title: '',
    date: selectedDate,
    time: '22:00',
    location: '',
    ticketUrl: '',
    notes: ''
  });

  const [status, setStatus] = useState<{ type: 'idle' | 'error' | 'success'; message?: string }>({
    type: 'idle'
  });
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState<{ id: string; editToken: string } | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<Event | null>(null);
  const [expandedRsvps, setExpandedRsvps] = useState<RSVP[]>([]);
  const [rsvpName, setRsvpName] = useState('');
  const [rsvpStatus, setRsvpStatus] = useState<string | null>(null);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [loadingEvent, setLoadingEvent] = useState(false);
  const [removalToken, setRemovalToken] = useState<string | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const searchParams = useSearchParams();

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, Event[]> = {};
    events.forEach((event) => {
      const date = event.startsAtLocal.split('T')[0];
      grouped[date] = grouped[date] ? [...grouped[date], event] : [event];
    });
    return grouped;
  }, [events]);

  const monthDays = useMemo(() => buildMonthGrid(monthCursor.year, monthCursor.monthIndex), [monthCursor]);

  const selectedEvents = eventsByDate[selectedDate] ?? [];

  useEffect(() => {
    if (!expandedEvent) {
      return;
    }
    setRemovalToken(localStorage.getItem(`rsvpToken:${expandedEvent.id}`));
    setEditToken(localStorage.getItem(`editToken:${expandedEvent.id}`));
  }, [expandedEvent]);

  useEffect(() => {
    const paramId = searchParams.get('event');
    if (paramId && events.length > 0) {
      openEvent(paramId, { forceSelectDate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, events]);

  const changeMonth = (delta: number) => {
    setMonthCursor((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.monthIndex + delta, 1));
      return { year: next.getUTCFullYear(), monthIndex: next.getUTCMonth() };
    });
  };

  const refreshEvents = async () => {
    const response = await fetch('/api/events');
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { events: Event[] };
    setEvents(data.events);
  };

  const handleSelectDate = (iso: string) => {
    setSelectedDate(iso);
    setFormState((prev) => ({ ...prev, date: iso }));
  };

  const handleChange = (field: keyof typeof formState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const getTurnstileToken = () => {
    if (!SITE_KEY) {
      return '';
    }
    const element = document.querySelector('textarea[name="cf-turnstile-response"]') as HTMLTextAreaElement | null;
    return element?.value ?? '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setStatus({ type: 'idle' });

    const response = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: formState.title,
        date: formState.date,
        time: formState.time,
        location: formState.location,
        ticketUrl: formState.ticketUrl,
        notes: formState.notes,
        turnstileToken: getTurnstileToken()
      })
    });

    if (!response.ok) {
      const data = await response.json();
      const message = data?.error === 'captcha_failed'
        ? 'Captcha failed. Please try again.'
        : 'Could not create event. Check required fields.';
      setStatus({ type: 'error', message });
      setCreating(false);
      return;
    }

    const data = (await response.json()) as { event: Event; editToken: string };
    localStorage.setItem(`editToken:${data.event.id}`, data.editToken);
    setCreatedInfo({ id: data.event.id, editToken: data.editToken });
    setStatus({ type: 'success', message: 'Event created.' });
    setFormState({ title: '', date: selectedDate, time: '19:00', location: '', ticketUrl: '', notes: '' });
    await refreshEvents();
    setCreating(false);
  };

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // fall back below
    }
    window.prompt('Copy this link:', text);
  };

  const openEvent = async (eventId: string, options?: { forceSelectDate?: boolean }) => {
    if (expandedEvent?.id === eventId) {
      setExpandedEvent(null);
      setExpandedRsvps([]);
      setRsvpStatus(null);
      return;
    }
    const summary = events.find((event) => event.id === eventId) ?? null;
    if (summary && (options?.forceSelectDate || selectedDate !== summary.startsAtLocal.split('T')[0])) {
      const date = summary.startsAtLocal.split('T')[0];
      setSelectedDate(date);
      const [year, month] = date.split('-').map(Number);
      setMonthCursor({ year, monthIndex: month - 1 });
    }
    setExpandedEvent(summary);
    setExpandedRsvps([]);
    setLoadingEvent(true);
    setRsvpStatus(null);
    const response = await fetch(`/api/events/${eventId}`, { cache: 'no-store' });
    if (!response.ok) {
      setLoadingEvent(false);
      setRsvpStatus('Could not load RSVPs. You can still RSVP below.');
      return;
    }
    const data = (await response.json()) as { event: Event; rsvps: RSVP[] };
    setExpandedEvent(data.event);
    setExpandedRsvps(data.rsvps);
    setLoadingEvent(false);
  };

  const updateEventInList = (eventId: string, goingCount: number) => {
    setEvents((prev) =>
      prev.map((event) => (event.id === eventId ? { ...event, goingCount } : event))
    );
  };

  const handleRsvp = async (allowDuplicate = false) => {
    if (!expandedEvent) {
      return;
    }
    setRsvpStatus(null);
    if (!rsvpName.trim()) {
      setRsvpStatus('Enter a nickname to RSVP.');
      return;
    }

    setRsvpLoading(true);
    let response: Response;
    try {
      response = await fetch(`/api/events/${expandedEvent.id}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: rsvpName, allowDuplicate })
      });
    } catch {
      setRsvpLoading(false);
      setRsvpStatus('Network error. Please try again.');
      return;
    }

    if (response.status === 409) {
      const proceed = window.confirm('That nickname already exists. Add anyway?');
      if (proceed) {
        await handleRsvp(true);
      }
      setRsvpLoading(false);
      return;
    }

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setRsvpStatus(data?.error ? `Could not add RSVP (${data.error}).` : 'Could not add RSVP.');
      setRsvpLoading(false);
      return;
    }

    const data = (await response.json()) as { rsvp: RSVP; goingCount: number };
    localStorage.setItem(`rsvpToken:${expandedEvent.id}`, data.rsvp.removalToken);
    setRemovalToken(data.rsvp.removalToken);
    setExpandedRsvps((prev) => [...prev, data.rsvp]);
    setExpandedEvent({ ...expandedEvent, goingCount: data.goingCount });
    updateEventInList(expandedEvent.id, data.goingCount);
    setRsvpName('');
    setRsvpLoading(false);
  };

  const handleRemoveRsvp = async () => {
    if (!expandedEvent || !removalToken) {
      return;
    }
    const response = await fetch(`/api/events/${expandedEvent.id}/rsvp`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ removalToken })
    });
    if (!response.ok) {
      setRsvpStatus('Could not remove RSVP.');
      return;
    }
    localStorage.removeItem(`rsvpToken:${expandedEvent.id}`);
    setRemovalToken(null);
    const data = (await response.json()) as { goingCount: number };
    setExpandedRsvps((prev) => prev.filter((rsvp) => rsvp.removalToken !== removalToken));
    setExpandedEvent({ ...expandedEvent, goingCount: data.goingCount });
    updateEventInList(expandedEvent.id, data.goingCount);
  };

  const handleReport = async () => {
    if (!expandedEvent) {
      return;
    }
    const reason = window.prompt('Report event (optional reason):');
    if (reason === null) {
      return;
    }
    await fetch(`/api/events/${expandedEvent.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    setRsvpStatus('Report submitted.');
  };

  const monthLabel = new Intl.DateTimeFormat('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(Date.UTC(monthCursor.year, monthCursor.monthIndex, 1)));

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <section className="card p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-display text-2xl">{monthLabel}</h2>
          <div className="flex gap-2">
            <button className="btn-ghost" type="button" onClick={() => changeMonth(-1)}>
              Prev
            </button>
            <button className="btn-ghost" type="button" onClick={() => changeMonth(1)}>
              Next
            </button>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-7 gap-2 text-xs uppercase text-ink/60">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="text-center">
              {day}
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-2">
          {monthDays.map((day) => {
            const hasEvents = (eventsByDate[day.iso] ?? []).length > 0;
            const isSelected = day.iso === selectedDate;
            return (
              <button
                key={day.iso}
                type="button"
                onClick={() => handleSelectDate(day.iso)}
                className={`flex h-14 flex-col rounded-xl border p-2 text-left transition ${
                  isSelected ? 'border-ink bg-ink text-white' : 'border-stone bg-white/70'
                } ${day.inMonth ? '' : 'opacity-50'}`}
              >
                <span className="text-sm font-semibold">{day.date.getUTCDate()}</span>
                {hasEvents && (
                  <span className={`mt-auto h-2 w-2 rounded-full ${isSelected ? 'bg-sun' : 'bg-accent'}`} />
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-6">
          <h3 className="text-lg font-semibold">Events on {formatUkDate(selectedDate)}</h3>
          <div className="mt-3 flex flex-col gap-3">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-ink/60">No events yet. Add one on the right.</p>
            ) : (
              selectedEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => openEvent(event.id)}
                  className={`card w-full p-4 text-left transition hover:-translate-y-0.5 ${
                    expandedEvent?.id === event.id ? 'border-ink/60' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold">{event.title}</p>
                      <p className="text-sm text-ink/60">
                        {event.startsAtLocal.split('T')[1]} · {event.location}
                      </p>
                    </div>
                    <div className="text-sm font-semibold">{event.goingCount} going</div>
                  </div>
                </button>
              ))
            )}
          </div>
          {loadingEvent ? (
            <p className="mt-4 text-sm text-ink/60">Loading event…</p>
          ) : null}
          {expandedEvent ? (
            <div className="mt-5 rounded-2xl border border-stone bg-white/80 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase text-ink/50">Event details</p>
                  <h4 className="text-xl font-semibold">{expandedEvent.title}</h4>
                  <p className="text-sm text-ink/70">{formatUkDateTime(expandedEvent.startsAtLocal)}</p>
                  <p className="text-sm text-ink/70">{expandedEvent.location}</p>
                  {expandedEvent.ticketUrl ? (
                    <a className="mt-2 inline-flex text-sm font-semibold text-accent" href={expandedEvent.ticketUrl}>
                      Ticket link
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    className="w-full rounded-xl border border-stone bg-white/80 px-3 py-2 text-sm"
                    readOnly
                    value={`/?event=${expandedEvent.id}`}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="btn-ghost"
                      type="button"
                      onClick={() => copyText(`${window.location.origin}/?event=${expandedEvent.id}`)}
                    >
                      Copy share link
                    </button>
                    {editToken ? (
                      <button
                        className="btn-ghost"
                        type="button"
                        onClick={() =>
                          copyText(`${window.location.origin}/event/${expandedEvent.id}/edit/${editToken}`)
                        }
                      >
                        Copy edit link
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
                    placeholder="Your nickname"
                    value={rsvpName}
                    onChange={(event) => setRsvpName(event.target.value)}
                  />
                  <button className="btn-accent" type="button" onClick={() => handleRsvp()} disabled={rsvpLoading}>
                    I&apos;m going
                  </button>
                </div>
                {removalToken ? (
                  <button className="btn-ghost w-fit" type="button" onClick={handleRemoveRsvp}>
                    Remove my RSVP
                  </button>
                ) : null}
              </div>

              <div className="mt-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-semibold">
                  <span>{expandedEvent.goingCount} going</span>
                  <button className="text-xs text-ink/50 underline" type="button" onClick={handleReport}>
                    Report event
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-2">
                  {expandedRsvps.length === 0 ? (
                    <p className="text-sm text-ink/60">No one yet. Be the first.</p>
                  ) : (
                    expandedRsvps.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between rounded-xl border border-stone bg-white/70 px-3 py-2"
                      >
                        <span>{item.nickname}</span>
                        <span className="text-xs text-ink/50">Joined</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {rsvpStatus ? <p className="mt-3 text-sm text-emerald-700">{rsvpStatus}</p> : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-display text-2xl">Add an event</h2>
        <p className="mt-2 text-sm text-ink/60">Required: name, date, ticket link. Time defaults to 22:00 UK.</p>

        <form className="mt-4 flex flex-col gap-3" onSubmit={handleSubmit}>
          <input
            className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
            placeholder="Event name"
            value={formState.title}
            onChange={(event) => handleChange('title', event.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="rounded-xl border border-stone bg-white/80 px-4 py-2"
              type="date"
              value={formState.date}
              onChange={(event) => handleChange('date', event.target.value)}
              required
            />
            <input
              className="rounded-xl border border-stone bg-white/80 px-4 py-2"
              type="time"
              value={formState.time}
              onChange={(event) => handleChange('time', event.target.value)}
            />
          </div>
          <input
            className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
            placeholder="Location (optional)"
            value={formState.location}
            onChange={(event) => handleChange('location', event.target.value)}
          />
          <input
            className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
            placeholder="Ticket link"
            value={formState.ticketUrl}
            onChange={(event) => handleChange('ticketUrl', event.target.value)}
            required
          />
          <textarea
            className="w-full rounded-xl border border-stone bg-white/80 px-4 py-2"
            placeholder="Notes (optional)"
            rows={3}
            value={formState.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
          />

          {SITE_KEY ? (
            <>
              <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
              <div className="cf-turnstile" data-sitekey={SITE_KEY} />
            </>
          ) : null}

          <button className="btn-accent" type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Create event'}
          </button>
        </form>

        {status.type !== 'idle' && (
          <p className={`mt-3 text-sm ${status.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
            {status.message}
          </p>
        )}

        {createdInfo && (
          <div className="mt-4 rounded-xl border border-stone bg-white/80 p-3 text-sm">
            <p className="font-semibold">Event created</p>
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => copyText(`${window.location.origin}/?event=${createdInfo.id}`)}
              >
                Copy event link
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() =>
                  copyText(`${window.location.origin}/event/${createdInfo.id}/edit/${createdInfo.editToken}`)
                }
              >
                Copy edit link
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
