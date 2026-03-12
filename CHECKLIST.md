# Build Checklist (MVP)

## Docs
- [x] PRD drafted
- [ ] User stories + acceptance criteria finalized

## Product
- [x] Calendar month view
- [x] Event creation form
- [x] Event detail page
- [x] RSVP add/remove (nickname)
- [x] Edit event via secret edit link
- [x] Copy share link button

## Sharing + OG
- [x] Server-rendered Open Graph tags
- [x] Dynamic OG image endpoint
- [x] Versioned OG image URL on RSVP count change

## Security/Abuse
- [x] Rate limit event creation
- [x] Rate limit RSVPs
- [x] CAPTCHA on event creation
- [x] Report event action

## Data/Storage
- [x] Persistence layer wired (file-based)
- [x] Event + RSVP schema
- [x] Edit token storage

## UX
- [x] Mobile-first styling
- [x] “All times shown in UK time” label
- [ ] Fast load (<2s on 4G)

## Deployment
- [ ] Vercel project setup
- [ ] ENV vars configured (captcha keys, storage)
- [ ] Production sanity test
