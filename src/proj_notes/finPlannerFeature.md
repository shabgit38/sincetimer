# FinPlanner Feature

## Purpose

FinPlanner is a finance planning screen for goal-based projections. The first goal is retirement planning using the user's existing Excel-style SIP and lumpsum projection model.

##Initial Assumptions

- The first version is frontend-only and does not save scenarios to the database.
- The page is reachable from the hamburger menu as `FinPlanner`.
- Retirement is the initial/default goal.
- The current age is fixed at `39`; the projection starts in `2025` and defaults to retirement at age `58`.
- Default starting monthly SIP is `INR 5,000`, with a `20%` annual step-up.
- Default existing corpus is `INR 450,000`; annual lumpsum defaults to `INR 0`.
- Expected annual return defaults to `10%`, inflation to `8%`, monthly expense to `INR 50,000`, and withdrawal rate to `4%`.

## Calculator Inputs

- Start year
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
- The required-contribution section shows both the required starting SIP when using the selected annual step-up and the alternative required fixed monthly SIP. Both estimates use the existing corpus and exclude annual lumpsums.
- Funding ratio is `projected corpus / target corpus * 100`; 100% or more means the target is fully funded.
- Expected real return accounts for inflation: `((1 + expected return) / (1 + inflation)) - 1`.

## UI Changes

- Add `FinPlanner` under the hamburger menu beside `Plans` and `Reading`.
- Add `/finplanner` route.
- Add a dedicated `FinPlanner` page with:
  - retirement goal heading
  - editable inputs for the start year, retirement age, SIP, returns, expenses, and annual lumpsum
  - independently editable annual-lumpsum values in the projection table
  - grouped summary cards:
    - **Goal:** target corpus, projected corpus, funding ratio, and projected surplus or shortfall
    - **Required contribution:** current SIP, required step-up SIP (including today's gap), and fixed-SIP alternative
    - **Planning context:** total invested, monthly expense at retirement, and expected real return
  - a horizontally scrollable, sticky-header year-by-year projection table for smaller screens

## Follow-ups

- Saved scenarios for Retirement, House, Education, Travel, and custom goals.
- Compare multiple return assumptions.
- Add charts for projected corpus vs target corpus.
- Add export/import to keep parity with spreadsheet workflows.
