# Pantri Analytics Metric Definitions

These definitions are the source of truth for admin and employer analytics UIs.
All monetary values are integer **kobo** (₦1 = 100 kobo).

## Data sources

| Label | Meaning |
|-------|---------|
| **Business** | Derived from existing Pantri tables (orders, credit, payroll, users). Available historically. |
| **Behavioral** | Derived from first-party `AnalyticsEvent` rows. Available only after `behavioralCollectionStartedAt`. |

When a behavioral chart has no data before collection started, show:
> Data collection started on [date]. Historical behavioral data is unavailable before this date.

---

## Engagement

### Active employee (period)
An employee who performs at least one **qualifying activity** event during the selected period.
Qualifying events exclude pure `session_ended` heartbeats; see `QUALIFYING_ACTIVITY_EVENTS`.

### DAU (Daily Active Users)
Unique employees (or users when employeeId is absent) with ≥1 qualifying activity on that calendar day (UTC).

### WAU / MAU
Same as DAU over a rolling 7-day or 30-day window ending on the selected end date.

### Session
A client-generated `sessionId` recorded in `AnalyticsSession`. Duration = `lastSeenAt − startedAt` (or `endedAt − startedAt` when ended).

### Engagement frequency
Average number of sessions per active employee in the period.

### Last active date
Max `occurredAt` of qualifying events for that employee/user.

---

## Commerce (business)

### Qualifying order
Orders with `fulfillmentStatus` not in (`DRAFT`, `CANCELLED`) unless stated otherwise. Revenue uses `totalKobo`.

### Average order value (AOV)
`sum(totalKobo of qualifying orders) ÷ count(qualifying orders)` in the period.

### Repeat purchaser
An employee with ≥2 qualifying orders in the analysis period (or all-time when the UI says so).

### Conversion rate (funnel stage)
`users completing target event ÷ users entering prior stage` (unique employees), behavioral.

---

## Credit & payroll (business)

### Outstanding balance
Sum of credit account principal/balance fields as exposed by the credit ledger (kobo).

### Credit utilization
`outstanding ÷ effective credit limit` (bps or percent as returned by APIs).

### Expected vs actual deductions
From `PayrollRun` / `PayrollDeductionLine` totals for the period.

---

## Retention & cohorts (Phase 1 purchase; Phase 2 behavioral)

### Purchase retention
Share of a registration or first-purchase cohort that places another qualifying order in a later period.

### Behavioral retention
Share of a cohort (first qualifying activity week) that has a qualifying activity in a later week — only for cohorts after collection start.

---

## Phase 2 intelligence

### RFM
Recency (days since last order), Frequency (order count), Monetary (sum totalKobo), scored into segments.

### Customer lifetime value (CLV)
Estimated from historical order totals (and optionally repayment behavior); not a guarantee of future spend.

### Anomaly
A KPI whose WoW or z-score vs recent baseline exceeds the configured threshold.

### What changed / Why
Narrative over the largest absolute and relative deltas for key KPIs between two periods, with contributing dimensions (employer, product, funnel step).
