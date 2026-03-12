# Shared Group Calendar PRD

## Summary
A lightweight, no-login, UK-timezone calendar for a WhatsApp group that allows fast event creation and frictionless RSVPs via custom nicknames. Each event has a shareable link whose WhatsApp preview shows the event name, date, location, and number going.

## Goals
- Create events in under 30 seconds on mobile.
- Allow anyone with the link to view and RSVP without login.
- Ensure WhatsApp link previews display accurate event metadata.
- Display all times in `Europe/London` regardless of viewer location.

## Non-Goals (MVP)
- Recurring events
- Payments or ticketing
- Full calendar sync (Google/Apple)
- Role-based permissions

## Target Users
- Large WhatsApp groups coordinating meetups, gigs, trips
- Predominantly mobile users

## Core Use Cases
1. Create an event with title, date/time, location, and ticket link.
2. RSVP by entering a custom nickname.
3. Share event link in WhatsApp and see a rich preview snippet.
4. Edit/delete an event using a private edit link.

## Functional Requirements
### Event Creation
- Required fields: title, date, time, location
- Optional fields: ticket link, notes
- Created events default to UK timezone (Europe/London)
- Creator receives an **Edit Link** (secret token) for updates/deletion
- Edit Link is shown once and stored locally for convenience

### Event Viewing
- Public, no login required
- Event detail shows: title, UK date/time, location, ticket link, notes, going count, and list of nicknames
- UI shows “All times shown in UK time”

### RSVP (Going)
- Add a custom nickname to the going list
- Prevent exact duplicates by default, but allow override (“Use anyway”) if same nickname exists
- Allow un-RSVP: users can remove their own RSVP via a removal token stored in their browser

### Sharing + WhatsApp Preview
- Each event has a public share URL
- Server-rendered Open Graph tags:
  - `og:title` = event name
  - `og:description` = “{Date}, {Location} • {X} going”
  - `og:type` = `website`
  - `og:url` = canonical event URL
  - `og:image` = dynamic image card with name/date/location/going
- `og:image` URL must change when going count changes (versioned query/hash)
- Cache headers allow preview refresh while remaining performant

### Abuse Prevention
- Rate limit event creation and RSVPs by IP
- Basic Turnstile/Captcha on event creation
- “Report event” action (logs for moderation; no login required)

## Data Model (MVP)
- Event: id, title, starts_at_utc, location, ticket_url, notes, created_at, updated_at
- RSVP: id, event_id, nickname, created_at, removal_token
- EditToken: event_id, token, created_at
- Report: id, event_id, reason, created_at

## UX Notes
- Mobile-first, <2s load on 4G
- “Copy link” button in event view
- Calendar month view with day dots for events

## Success Metrics
- Median event creation time <30 seconds
- >60% traffic from mobile
- >30% RSVP rate per event

## Risks & Mitigations
- WhatsApp preview caching: versioned `og:image` URLs and cache headers
- Spam/abuse: rate limiting + CAPTCHA on event creation
- No-login ownership: Edit Link token + local storage convenience

## Out of Scope for MVP
- Multi-day events
- .ics export
- Private/invite-only lists

## Open Questions
- Should anonymous RSVPs be limited per IP per day?
- Should event editing be time-limited (e.g., lock 2 hours after start)?
