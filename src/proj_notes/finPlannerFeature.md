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
- Default annual lumpsum (each projection year remains independently editable)
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
- Monthly expense
- Annual expense

## Formulas

- Table rows represent completed age-to-age investment periods, not future plans.
- Existing Corpus is a one-time opening balance representing investments made before the first projection period.
- The age `39` row represents the completed age `39` to `40` period and includes that period's SIPs, year-end lumpsum, and end-of-period corpus.
- Rows continue through age `57`, which represents the completed age `57` to `58` period. Retirement age `58` is the resulting summary snapshot, not another contribution row.
- A projection from age `39` to `58` therefore contains `19` investment rows and exactly `19` growth periods.
- `annualSip = monthlySip * 12` and `monthlySip` increases each investment year by the annual SIP step-up percentage.
- Expected annual return is treated as an effective annual return (CAGR), with `monthlyRate = (1 + expectedAnnualReturn)^(1/12) - 1`, and SIPs are beginning-of-month contributions.
- The future value of 12 monthly SIPs for one year is `monthlySip * (((1 + monthlyRate)^12 - 1) / monthlyRate) * (1 + monthlyRate)`.
- The prior corpus compounds for 12 months using `(1 + monthlyRate)^12`.
- The annual lumpsum is added at year-end after growth, so it receives no return during that same year.
- Each row's end-of-period corpus is `priorCorpus * (1 + monthlyRate)^12 + SIP future value + year-end lumpsum`.
- Monthly expense is current monthly expense inflated for each row's starting age; annual expense is monthly expense multiplied by 12.
- Retirement expense is inflated through the full number of years to retirement, and retirement target corpus is that annual expense divided by withdrawal rate.
- Surplus or shortfall is projected corpus at retirement minus target corpus.
- Required SIP estimation uses the same Zerodha beginning-of-month monthly-compounding convention.

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
