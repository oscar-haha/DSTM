export type Event = {
  id: string;
  title: string;
  startsAtLocal: string; // YYYY-MM-DDTHH:mm in UK time
  location: string;
  ticketUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  goingCount: number;
};

export type RSVP = {
  id: string;
  eventId: string;
  nickname: string;
  createdAt: string;
  removalToken: string;
};

export type Report = {
  id: string;
  eventId: string;
  reason: string;
  createdAt: string;
};

export type StoreData = {
  events: Event[];
  rsvps: Record<string, RSVP[]>;
  editTokens: Record<string, string>;
  reports: Report[];
};
