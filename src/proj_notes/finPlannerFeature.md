# FinPlanner Feature

## Purpose

FinPlanner is a finance planning screen for goal-based projections. The first goal is retirement planning using the user's existing Excel-style SIP and lumpsum projection model.

## Initial Assumptions

- The first version is frontend-only and does not save scenarios to the database.
- The page is reachable from the hamburger menu as `FinPlanner`.
- Retirement is the initial/default goal.
- SIP annual step-up is editable and defaults to `20%`.
- Expected return defaults to `10%`.
- The projection starts from `2025`, current age `39`, and retirement age `58`, matching the reference sheet.

## Calculator Inputs

- Start year
- Current age
- Retirement age
- Current monthly SIP
- Annual SIP step-up %
- Existing corpus
- Expected annual return %
- First-year annual lumpsum
- Regular annual lumpsum
- Lumpsum starts after N years
- Current monthly expense
- Inflation %
- Retirement withdrawal rate %

## Projection Columns

- Year
- Age
- Monthly SIP
- Annual SIP
- SIP corpus
- Annual lumpsum
- Lumpsum corpus
- Total invested
- Projected corpus
- Monthly required
- Annual required

## Formulas

- `annualSip = monthlySip * 12`
- `monthlySip` increases each year by the annual SIP step-up percentage.
- SIP corpus compounds annually with expected return after adding that year's annual SIP.
- Lumpsum corpus compounds annually with expected return after adding that year's lumpsum.
- Projected corpus is existing corpus compounded alongside SIP and lumpsum flows.
- Monthly required amount is current monthly expense inflated by the inflation percentage for each year.
- Annual required amount is monthly required amount multiplied by 12.
- Retirement target corpus is annual required amount at retirement divided by withdrawal rate.
- Surplus or shortfall is projected corpus at retirement minus target corpus.

## UI Changes

- Add `FinPlanner` under the hamburger menu beside `Plans` and `Reading`.
- Add `/finplanner` route.
- Add a dedicated `FinPlanner` page with:
  - retirement goal heading
  - input controls
  - summary cards
  - year-by-year projection table

## Follow-ups

- Saved scenarios for Retirement, House, Education, Travel, and custom goals.
- Compare multiple return assumptions.
- Add charts for projected corpus vs target corpus.
- Add export/import to keep parity with spreadsheet workflows.
