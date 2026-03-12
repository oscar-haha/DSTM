import { kv } from '@vercel/kv';
import { promises as fs } from 'fs';
import path from 'path';
import { Event, RSVP, Report, StoreData } from './types';

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), '.data', 'group-calendar.json');
const useKv = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

// ---------- Shared helpers ----------
function nowIso() {
  return new Date().toISOString();
}

function emptyData(): StoreData {
  return { events: [], rsvps: {}, editTokens: {}, reports: [] };
}

function sortEvents(events: Event[]) {
  return [...events].sort((a, b) => a.startsAtLocal.localeCompare(b.startsAtLocal));
}

// ---------- File fallback ----------
async function ensureFile() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    const dir = path.dirname(DATA_PATH);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(emptyData(), null, 2), 'utf-8');
  }
}

async function readFileStore(): Promise<StoreData> {
  await ensureFile();
  const raw = await fs.readFile(DATA_PATH, 'utf-8');
  try {
    return JSON.parse(raw) as StoreData;
  } catch {
    return emptyData();
  }
}

async function writeFileStore(data: StoreData) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ---------- KV implementation ----------
async function kvListEvents(): Promise<Event[]> {
  const ids = ((await kv.smembers<string>('events')) || []) as string[];
  if (ids.length === 0) return [];
  const events = await Promise.all(ids.map((id) => kv.get<Event>(`event:${id}`)));
  return sortEvents(events.filter(Boolean) as Event[]);
}

async function kvGetEvent(id: string) {
  const event = await kv.get<Event>(`event:${id}`);
  if (!event) return null;
  const rsvps = (await kv.get<RSVP[]>(`rsvps:${id}`)) || [];
  return { event, rsvps };
}

async function kvCreateEvent(input: {
  title: string;
  startsAtLocal: string;
  location?: string;
  ticketUrl: string;
  notes?: string;
}) {
  const id = crypto.randomUUID();
  const editToken = crypto.randomUUID();
  const createdAt = nowIso();
  const event: Event = {
    id,
    title: input.title,
    startsAtLocal: input.startsAtLocal,
    location: input.location ?? '',
    ticketUrl: input.ticketUrl,
    notes: input.notes,
    createdAt,
    updatedAt: createdAt,
    goingCount: 0
  };

  await Promise.all([
    kv.sadd('events', id),
    kv.set(`event:${id}`, event),
    kv.set(`edit:${id}`, editToken),
    kv.set(`rsvps:${id}`, [])
  ]);

  return { event, editToken };
}

async function kvUpdateEvent(id: string, token: string, updates: Partial<Omit<Event, 'id' | 'createdAt' | 'goingCount'>>) {
  const storedToken = await kv.get<string>(`edit:${id}`);
  if (storedToken !== token) return { ok: false, reason: 'forbidden' as const };

  const existing = await kv.get<Event>(`event:${id}`);
  if (!existing) return { ok: false, reason: 'not_found' as const };

  const updated: Event = {
    ...existing,
    title: updates.title ?? existing.title,
    startsAtLocal: updates.startsAtLocal ?? existing.startsAtLocal,
    location: updates.location ?? existing.location,
    ticketUrl: updates.ticketUrl ?? existing.ticketUrl,
    notes: updates.notes ?? existing.notes,
    updatedAt: nowIso()
  };

  await kv.set(`event:${id}`, updated);
  return { ok: true as const, event: updated };
}

async function kvDeleteEvent(id: string, token: string) {
  const storedToken = await kv.get<string>(`edit:${id}`);
  if (storedToken !== token) return { ok: false, reason: 'forbidden' as const };

  await Promise.all([
    kv.srem('events', id),
    kv.del(`event:${id}`),
    kv.del(`edit:${id}`),
    kv.del(`rsvps:${id}`)
  ]);

  return { ok: true as const };
}

async function kvAddRsvp(id: string, nickname: string, allowDuplicate: boolean) {
  const event = await kv.get<Event>(`event:${id}`);
  if (!event) return { ok: false, reason: 'not_found' as const };

  const normalized = nickname.trim();
  if (!normalized) return { ok: false, reason: 'invalid' as const };

  const rsvps = (await kv.get<RSVP[]>(`rsvps:${id}`)) || [];
  const exists = rsvps.some((r) => r.nickname.toLowerCase() === normalized.toLowerCase());
  if (exists && !allowDuplicate) {
    return { ok: false, reason: 'duplicate' as const, goingCount: rsvps.length };
  }

  const rsvp: RSVP = {
    id: crypto.randomUUID(),
    eventId: id,
    nickname: normalized,
    createdAt: nowIso(),
    removalToken: crypto.randomUUID()
  };

  const next = [...rsvps, rsvp];
  event.goingCount = next.length;
  event.updatedAt = nowIso();

  await Promise.all([kv.set(`rsvps:${id}`, next), kv.set(`event:${id}`, event)]);
  return { ok: true as const, rsvp, goingCount: next.length };
}

async function kvRemoveRsvp(id: string, removalToken: string) {
  const rsvps = (await kv.get<RSVP[]>(`rsvps:${id}`)) || [];
  const next = rsvps.filter((r) => r.removalToken !== removalToken);
  if (next.length === rsvps.length) return { ok: false, reason: 'not_found' as const };

  const event = await kv.get<Event>(`event:${id}`);
  if (event) {
    event.goingCount = next.length;
    event.updatedAt = nowIso();
    await kv.set(`event:${id}`, event);
  }
  await kv.set(`rsvps:${id}`, next);
  return { ok: true as const, goingCount: next.length };
}

async function kvReportEvent(id: string, reason: string) {
  const report: Report = {
    id: crypto.randomUUID(),
    eventId: id,
    reason: reason.trim() || 'No reason provided',
    createdAt: nowIso()
  };
  await kv.rpush('reports', report);
  return { ok: true as const };
}

async function kvListRsvps(id: string) {
  return ((await kv.get<RSVP[]>(`rsvps:${id}`)) || []) as RSVP[];
}

async function kvGetEditToken(id: string) {
  return (await kv.get<string>(`edit:${id}`)) ?? null;
}

// ---------- File implementation ----------
async function fileListEvents() {
  const data = await readFileStore();
  return sortEvents(data.events);
}

async function fileGetEvent(id: string) {
  const data = await readFileStore();
  const event = data.events.find((item) => item.id === id);
  if (!event) return null;
  const rsvps = data.rsvps[id] ?? [];
  return { event, rsvps };
}

async function fileCreateEvent(input: {
  title: string;
  startsAtLocal: string;
  location?: string;
  ticketUrl: string;
  notes?: string;
}) {
  const data = await readFileStore();
  const id = crypto.randomUUID();
  const editToken = crypto.randomUUID();
  const createdAt = nowIso();
  const event: Event = {
    id,
    title: input.title,
    startsAtLocal: input.startsAtLocal,
    location: input.location ?? '',
    ticketUrl: input.ticketUrl,
    notes: input.notes,
    createdAt,
    updatedAt: createdAt,
    goingCount: 0
  };

  data.events.push(event);
  data.editTokens[id] = editToken;
  data.rsvps[id] = [];

  await writeFileStore(data);
  return { event, editToken };
}

async function fileUpdateEvent(id: string, token: string, updates: Partial<Omit<Event, 'id' | 'createdAt' | 'goingCount'>>) {
  const data = await readFileStore();
  if (data.editTokens[id] !== token) return { ok: false, reason: 'forbidden' as const };

  const index = data.events.findIndex((event) => event.id === id);
  if (index === -1) return { ok: false, reason: 'not_found' as const };

  const current = data.events[index];
  const updated: Event = {
    ...current,
    title: updates.title ?? current.title,
    startsAtLocal: updates.startsAtLocal ?? current.startsAtLocal,
    location: updates.location ?? current.location,
    ticketUrl: updates.ticketUrl ?? current.ticketUrl,
    notes: updates.notes ?? current.notes,
    updatedAt: nowIso()
  };

  data.events[index] = updated;
  await writeFileStore(data);
  return { ok: true as const, event: updated };
}

async function fileDeleteEvent(id: string, token: string) {
  const data = await readFileStore();
  if (data.editTokens[id] !== token) return { ok: false, reason: 'forbidden' as const };

  data.events = data.events.filter((event) => event.id !== id);
  delete data.rsvps[id];
  delete data.editTokens[id];
  await writeFileStore(data);
  return { ok: true as const };
}

async function fileAddRsvp(id: string, nickname: string, allowDuplicate: boolean) {
  const data = await readFileStore();
  const event = data.events.find((item) => item.id === id);
  if (!event) return { ok: false, reason: 'not_found' as const };

  const normalized = nickname.trim();
  if (!normalized) return { ok: false, reason: 'invalid' as const };

  const rsvps = data.rsvps[id] ?? [];
  const exists = rsvps.some((rsvp) => rsvp.nickname.toLowerCase() === normalized.toLowerCase());
  if (exists && !allowDuplicate) return { ok: false, reason: 'duplicate' as const, goingCount: rsvps.length };

  const rsvp: RSVP = {
    id: crypto.randomUUID(),
    eventId: id,
    nickname: normalized,
    createdAt: nowIso(),
    removalToken: crypto.randomUUID()
  };

  rsvps.push(rsvp);
  data.rsvps[id] = rsvps;
  event.goingCount = rsvps.length;
  event.updatedAt = nowIso();

  await writeFileStore(data);
  return { ok: true as const, rsvp, goingCount: rsvps.length };
}

async function fileRemoveRsvp(id: string, removalToken: string) {
  const data = await readFileStore();
  const rsvps = data.rsvps[id] ?? [];
  const next = rsvps.filter((rsvp) => rsvp.removalToken !== removalToken);
  if (next.length === rsvps.length) return { ok: false, reason: 'not_found' as const };

  data.rsvps[id] = next;
  const event = data.events.find((item) => item.id === id);
  if (event) {
    event.goingCount = next.length;
    event.updatedAt = nowIso();
  }

  await writeFileStore(data);
  return { ok: true as const, goingCount: next.length };
}

async function fileReportEvent(id: string, reason: string) {
  const data = await readFileStore();
  const report: Report = {
    id: crypto.randomUUID(),
    eventId: id,
    reason: reason.trim() || 'No reason provided',
    createdAt: nowIso()
  };
  data.reports.push(report);
  await writeFileStore(data);
  return { ok: true as const };
}

async function fileListRsvps(id: string) {
  const data = await readFileStore();
  return data.rsvps[id] ?? [];
}

async function fileGetEditToken(id: string) {
  const data = await readFileStore();
  return data.editTokens[id];
}

// ---------- Public API ----------
export async function listEvents() {
  return useKv ? kvListEvents() : fileListEvents();
}

export async function getEvent(id: string) {
  return useKv ? kvGetEvent(id) : fileGetEvent(id);
}

export async function createEvent(input: {
  title: string;
  startsAtLocal: string;
  location?: string;
  ticketUrl: string;
  notes?: string;
}) {
  return useKv ? kvCreateEvent(input) : fileCreateEvent(input);
}

export async function updateEvent(id: string, token: string, updates: Partial<Omit<Event, 'id' | 'createdAt' | 'goingCount'>>) {
  return useKv ? kvUpdateEvent(id, token, updates) : fileUpdateEvent(id, token, updates);
}

export async function deleteEvent(id: string, token: string) {
  return useKv ? kvDeleteEvent(id, token) : fileDeleteEvent(id, token);
}

export async function addRsvp(id: string, nickname: string, allowDuplicate: boolean) {
  return useKv ? kvAddRsvp(id, nickname, allowDuplicate) : fileAddRsvp(id, nickname, allowDuplicate);
}

export async function removeRsvp(id: string, removalToken: string) {
  return useKv ? kvRemoveRsvp(id, removalToken) : fileRemoveRsvp(id, removalToken);
}

export async function reportEvent(id: string, reason: string) {
  return useKv ? kvReportEvent(id, reason) : fileReportEvent(id, reason);
}

export async function listRsvps(id: string) {
  return useKv ? kvListRsvps(id) : fileListRsvps(id);
}

export async function getEditToken(id: string) {
  return useKv ? kvGetEditToken(id) : fileGetEditToken(id);
}
