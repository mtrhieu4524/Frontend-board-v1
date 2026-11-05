# DECISIONS

Write in English. Short bullet points are fine. Reviewers read this file alongside your code.

## What I assumed

<!-- Anything the brief did not say that you had to decide. -->

- Default date range is the last 30 days in the viewer's local calendar, written into the URL once sites are known.
- Shareable state lives at `/board?...`; a request is `/requests/:id` with the same query so Back restores the board.
- Page size defaults to 20, choices are 5, 10, 20, 50, 100. `page` is always in the URL. `size` only when it is not 20. Changing a filter or sort resets to page 1.
- First response (rule 6) ignores undone events (rule 5), so an undone `processing` event is not treated as the first response.
- "Last updated" is the viewer's local clock, with a short zone name (e.g. GMT+7), not a site timezone.
- The change feed is polled every 30 seconds (under the brief's one-minute limit). A hidden tab does not poll, it catches up when it is shown again.
- The open request page is a snapshot, live updates apply to the board, not to the detail view already on screen.
- A row that just changed is highlighted for 8 seconds, then the colour goes away.
- After a failed board or detail load, retry automatically after 15 seconds; keep the last successful list on screen if there is one.

## What I found in the API or data

<!-- Anything that did not match the docs, or surprised you, and how you handled it. -->

- `created_from` / `created_to` filter on UTC dates as `DD/MM/YYYY`, not each site's local date. I fetch one extra day on each side and apply rule 1 locally with the site timezone.
- `/v1/changes` starts in April and is tens of thousands of items. Pages overlap (the same `seq` can appear twice). I take a list snapshot first, catch the feed up in the background, and merge idempotently.
- `request` on a change is the request **as it is now**, and a later page can still carry an older copy. I ignore a copy whose `updated_at` is not newer than what I already have.
- Cursors look like `{"s":seq,"t":time}` and expire after about 15 minutes (`410`). I store the cursor in `sessionStorage` for 10 minutes; on `410` I start the feed again with no cursor.
- Endpoints return `429` with `Retry-After`, and sometimes `503`. The client waits (Retry-After capped at 10s, otherwise exponential backoff, 5 attempts) and the board says the helpdesk is busy or briefly down.

## How I used AI

<!-- Which tools, what you asked, what came back wrong, what you changed. "I didn't use AI" is fine too. -->

- AI to help optimise the code and the design: table vs cards on a phone, live-status layout, loading / empty / error banners, and splitting URL state, rules, and the change-feed merge into small modules.

## Trade-offs and what I would do next

<!-- What you left out to stay within 3 hours, and what you would do with more time. -->

- Catching up the change feed on a first visit still costs many `/v1/changes` calls. A saved cursor avoids that on reload, with more time I would persist a compact snapshot so a new session does not replay from the start.
- I did not use site holidays or business hours, even though the API exposes them. Overdue is only "due date before today in the site zone", as rule 2 states.
- The detail page does not apply the live feed. With more time I would patch the open request from `request.updated` / `event.created` instead of leaving it until the next visit.
- No end-to-end tests in the browser, coverage is unit tests plus manual checks.
