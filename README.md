# Smart Fox VTU — Current Master Build

This build combines the latest Milestone 1 Upgrade 3 brand-logo frontend with the Milestone 2.1 backend foundation.

## Frontend
- Smart Fox VTU branding using the supplied company logo
- Responsive customer pages
- Admin dashboard
- Airtime and data services
- Regular, Corporate and Gift data plan categories
- Network logo assets
- Wallet, transactions, profile, notifications and support pages

## Backend — Milestone 2.1
See `backend/README.md` for setup instructions.

The backend foundation includes Node.js + Express, MySQL configuration, security middleware, API health check and the initial database schema.

## Current status
The frontend is not yet connected to authentication, wallet APIs or real VTU/payment providers. Those are subsequent milestones.

## Frontend Refinement — Welcome, Data Purchase & Receipt
- Added 2.5-second branded welcome splash on the public landing page.
- Added network logo assets for MTN, Airtel, Glo and 9mobile to the data purchase interface.
- Added richer card/service shadows and selected-network states.
- Added a detailed transaction success/receipt modal for data and airtime purchases.
- Receipt is currently frontend/demo data; backend transaction verification will replace the demo flow later.


Frontend refinement update: dedicated welcome splash, first-login welcome/onboarding, 4-digit transaction PIN, protected data/airtime purchase flow, and dedicated shareable/downloadable transaction receipt page.
