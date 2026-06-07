# Phorest API Integration

**Docs:** https://developer.phorest.com/docs/getting-started  
**API Reference:** https://developer.phorest.com/reference  
**Access:** Email api-requests@phorest.com with your Phorest Account Number

---

## Authentication

HTTP Basic Auth — credentials provided by Phorest on approval.

```
Username: global/your@email.com
Password: <provided by Phorest>
```

## Base URLs

| Region | URL |
|---|---|
| EU | `https://platform.phorest.com/third-party-api-server/api/business/{businessId}` |
| US | `https://platform-us.phorest.com/third-party-api-server/api/business/{businessId}` |

## Key Endpoints

### Clients
- `GET /client` — list clients
- `GET /client/{clientId}` — get client
- `POST /client` — create client
- `PUT /client/{clientId}` — update client

### Appointments
- `GET /branch/{branchId}/appointment` — list appointments (filter by date, staff, client)
- `GET /branch/{branchId}/appointment/available` — find available slots
- `POST /branch/{branchId}/booking` — create booking
- `POST /branch/{branchId}/appointment/checkin` — check in

### Loyalty Points
- `POST /loyaltypoints` — add or deduct points
  - Body: `clientId`, `branchId`, `pointsChange`, `operationType` (ADD/DEDUCT), `description`

## Important Limitations

- **No webhooks** — must poll using `updated_at` field to detect changes
- **No payment processing** — card/Phorest Pay not exposed via API
- All times in **UTC**
- Pagination: `?page=0&size=50`

---

## Planned Integrations

### 1. Personalised Wallet Passes
Poll Phorest for new/updated clients → generate a personalised `.pkpass` for each → deliver via SMS or email link.

```
GET /client?updated_at_after={timestamp}
→ for each new client:
  GET /api/generate-pass?member={firstName+lastName}
→ send pass URL to client phone/email
```

### 2. QR Scan Tracking
Replace static `PASS_TARGET_URL` with a Vercel API route (`/api/scan?patient={id}`) that:
- Logs the scan (timestamp, patient ID)
- Redirects to patient portal

Requires: Vercel KV or Postgres for log storage.

### 3. Loyalty Point Sync
After each appointment, POST to Phorest loyalty endpoint to award points.
```
POST /loyaltypoints
{ clientId, branchId, pointsChange: 100, operationType: "ADD", description: "Wallet pass visit" }
```

---

## Env Vars Needed

```
PHOREST_USERNAME=global/aesthetics@treasuryhealth.ca
PHOREST_PASSWORD=<from Phorest>
PHOREST_BUSINESS_ID=<your business ID from Phorest>
PHOREST_BRANCH_ID=<your branch ID from Phorest>
```
