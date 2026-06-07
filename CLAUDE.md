# Treasury Aesthetics Wallet — Claude Instructions

## "update my PC"

When the user says **"update my PC"**, do exactly this:

1. Update `currentstate.md` in the repo root with a comprehensive summary of the current project state, including:
   - Architecture overview
   - All files and their purpose (with any changes since last update)
   - All required environment variables
   - Pending issues / known bugs
   - Recent changes made this session
2. Commit the file with message: `Update currentstate.md`
3. Push to `main` on GitHub

This file is read by the user's local Claude Code instance when starting a new session so they have full context without re-explaining the project.

---

## Project Context

This is the **Treasury Aesthetics Apple Wallet pass system** — a Vercel-hosted Node.js app that automatically generates and emails personalised `.pkpass` loyalty passes to new Phorest clinic clients.

- GitHub: `drlatsky-aesthetics/Wallet`
- Production branch: `main`
- Production URL: `https://wallet-tau-green.vercel.app`
- See `currentstate.md` for full architecture, file map, and env vars
