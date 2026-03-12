import { promises as fs } from 'fs';
import path from 'path';
import { Event, RSVP, Report, StoreData } from './types';

const DATA_PATH = process.env.DATA_PATH || path.join(process.cwd(), '.data', 'group-calendar.json');

function nowIso() {
  return new Date().toISOString();
}

function emptyData(): StoreData {
  return { events: [], rsvps: {}, editTokens: {}, reports: [] };
}

async function ensureDataFile() {
  try {
    await fs.access(DATA_PATH);
    return;
  } catch {
    // continue
  }

  const legacyPath = '/tmp/group-calendar.json';
  if (!process.env.DATA_PATH) {
    try {
      await fs.access(legacyPath);
      const legacyData = await fs.readFile(legacyPath, 'utf-8');
      const dir = path.dirname(DATA_PATH);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(DATA_PATH, legacyData, 'utf-8');
      return;
    } catch {
      // fall through to initialize empty
    }
  }

  const dir = path.dirname(DATA_PATH);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(emptyData(), null, 2), 'utf-8');
}

async function readData(): Promise<StoreData> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_PATH, 'utf-8');
  try {
    return JSON.parse(raw) as StoreData;
  } catch {
    return emptyData();
  }
}

async function writeData(data: StoreData) {
  await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function sortEvents(events: Event[]) {
  return [...events].sort((a, b) => a.startsAtLocal.localeCompare(b.startsAtLocal));
}

export async function listEvents() {
  const data = await readData();
  return sortEvents(data.events);
}

export async function getEvent(id: string) {
  const data = await readData();
  const event = data.events.find((item) => item.id === id);
  if (!event) {
    return null;
  }
  const rsvps = data.rsvps[id] ?? [];
  return { event, rsvps };
}

export async function createEvent(input: {
  title: string;
  startsAtLocal: string;
  location?: string;
  ticketUrl: string;
  notes?: string;
}) {
  const data = await readData();
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

  await writeData(data);

  return { event, editToken };
}

export async function updateEvent(id: string, token: string, updates: Partial<Omit<Event, 'id' | 'createdAt' | 'goingCount'>>) {
  const data = await readData();
  if (data.editTokens[id] !== token) {
    return { ok: false, reason: 'forbidden' as const };
  }

  const index = data.events.findIndex((event) => event.id === id);
  if (index === -1) {
    return { ok: false, reason: 'not_found' as const };
  }

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
  await writeData(data);

  return { ok: true as const, event: updated };
}

export async function deleteEvent(id: string, token: string) {
  const data = await readData();
  if (data.editTokens[id] !== token) {
    return { ok: false, reason: 'forbidden' as const };
  }

  data.events = data.events.filter((event) => event.id !== id);
  delete data.rsvps[id];
  delete data.editTokens[id];

  await writeData(data);
  return { ok: true as const };
}

export async function addRsvp(id: string, nickname: string, allowDuplicate: boolean) {
  const data = await readData();
  const event = data.events.find((item) => item.id === id);
  if (!event) {
    return { ok: false, reason: 'not_found' as const };
  }

  const normalized = nickname.trim();
  if (!normalized) {
    return { ok: false, reason: 'invalid' as const };
  }

  const rsvps = data.rsvps[id] ?? [];
  const exists = rsvps.some((rsvp) => rsvp.nickname.toLowerCase() === normalized.toLowerCase());
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

  rsvps.push(rsvp);
  data.rsvps[id] = rsvps;
  event.goingCount = rsvps.length;
  event.updatedAt = nowIso();

  await writeData(data);

  return { ok: true as const, rsvp, goingCount: rsvps.length };
}

export async function removeRsvp(id: string, removalToken: string) {
  const data = await readData();
  const rsvps = data.rsvps[id] ?? [];
  const next = rsvps.filter((rsvp) => rsvp.removalToken !== removalToken);

  if (next.length === rsvps.length) {
    return { ok: false, reason: 'not_found' as const };
  }

  data.rsvps[id] = next;
  const event = data.events.find((item) => item.id === id);
  if (event) {
    event.goingCount = next.length;
    event.updatedAt = nowIso();
  }

  await writeData(data);
  return { ok: true as const, goingCount: next.length };
}

export async function reportEvent(id: string, reason: string) {
  const data = await readData();
  const report: Report = {
    id: crypto.randomUUID(),
    eventId: id,
    reason: reason.trim() || 'No reason provided',
    createdAt: nowIso()
  };
  data.reports.push(report);
  await writeData(data);
  return { ok: true as const };
}

export async function listRsvps(id: string) {
  const data = await readData();
  return data.rsvps[id] ?? [];
}

export async function getEditToken(id: string) {
  const data = await readData();
  return data.editTokens[id];
}
