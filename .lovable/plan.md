# Refine portfolio and globe startup

## What will change
- Give Email, LinkedIn, Instagram, WhatsApp, and Telegram their recognizable brand colors while keeping the contact list clear and accessible.
- Replace the small inline project gallery with a centered, large portfolio viewer so screenshots can be inspected comfortably.
- Expand each portfolio project into a structured case study with: project title, service/category, client or company, completion year, project link, short overview, tools/skills, results, and multiple screenshots.
- Update the profile editor so all screenshots selected together belong to one project, validate entries, and present the added project information systematically.
- Start every signed-out visit on the rotating full Earth instead of locating the visitor by IP.
- For returning signed-in users with a saved location, begin on their saved city at a city-level zoom using the saved coordinates and city label (for example, Bengaluru, India).

## Experience details
- The globe will rotate gently only in the initial world view and stop when the user interacts or the app flies to a saved city, country, profile, or chosen point.
- The portfolio opens above the map and profile panel, supports a clear close action, and uses a large screenshot area with project details alongside it.
- Multiple screenshots will be selectable within each project without leaving the viewer.
- Existing portfolio entries remain visible with sensible defaults where newer case-study details are absent.

## Technical details
- Extend the portfolio data model without deleting existing records, preserving the current image field for compatibility while adding grouped screenshots and case-study fields.
- Keep media private and continue serving images through signed links.
- Add keyboard and backdrop closing for the portfolio viewer, responsive layouts, and reduced-motion behavior.
- Verify signed-out globe startup, returning-user city focus, contact colors, project creation, and the centered viewer on desktop and mobile.
