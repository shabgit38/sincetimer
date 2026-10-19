export const EXPENSE_CATEGORIES = [
  "Electricity",
  "Internet",
  "Mobile",
  "Gas",
  "Water",
  "Groceries",
  "Travel",
  "Maintenance",
  "Entertainment",
  "Subscriptions",
  "Home Improvement",
  "Learning",
  "Personal",
  "Health",
  "Insurance",
  "Emergency / Unplanned",
  "Rent",
  "EMI / Loan",
  "SIP",
  "Lumpsum Investment",
  "Other",
] as const;

export const EXPENSE_FREQUENCIES = [
  "monthly",
  "quarterly",
  "half-yearly",
  "annual",
  "one-time",
] as const;

export const EXPENSE_TYPES = [
  "essential",
  "discretionary",
  "health",
  "housing",
  "irregular",
  "debt",
  "investment",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type ExpenseFrequency = (typeof EXPENSE_FREQUENCIES)[number];
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

export interface ExpenseItem {
  id: string;
  name: string;
  category: ExpenseCategory;
  /** Amount charged at each occurrence of frequency. */
  monthlyAmount: number;
  frequency: ExpenseFrequency;
  /** Optional stored/display value; calculations always derive this from monthlyAmount and frequency. */
  annualAmount?: number;
  /** Optional first-forecast-year amount, in the same units as monthlyAmount. */
  projectionBaseAmount?: number;
  inflationRate: number;
  expenseType: ExpenseType;
  essential: boolean;
  retirementIncluded: boolean;
  startYear: number;
  endYear?: number;
  notes: string;
  active: boolean;
}

export interface ExpenseAmounts {
  monthlyAmount: number;
  annualAmount: number;
}

export interface ProjectedExpense extends ExpenseItem {
  projectedMonthlyAmount: number;
  projectedAnnualAmount: number;
  appliedInflationRate: number;
  projectionYears: number;
}

export interface ExpenseTotals {
  monthlyAmount: number;
  annualAmount: number;
}

export interface FutureExpenseProjection {
  totalProjectedExpense: ExpenseTotals;
  projectedLivingExpense: ExpenseTotals;
  projectedInvestmentContribution: ExpenseTotals;
  essentialExpense: ExpenseTotals;
  discretionaryExpense: ExpenseTotals;
  healthExpense: ExpenseTotals;
  irregularExpense: ExpenseTotals;
  expenses: ProjectedExpense[];
}

export interface CurrentBudgetSummary {
  totalCurrentExpense: ExpenseTotals;
  totalCurrentLivingExpense: ExpenseTotals;
  totalInvestmentContribution: ExpenseTotals;
  essentialExpense: ExpenseTotals;
  discretionaryExpense: ExpenseTotals;
  healthExpense: ExpenseTotals;
  irregularExpense: ExpenseTotals;
}

export interface RetirementExpenseSummary {
  retirementEligibleExpense: ExpenseTotals;
  essentialExpense: ExpenseTotals;
  discretionaryExpense: ExpenseTotals;
  healthExpense: ExpenseTotals;
  irregularExpense: ExpenseTotals;
  expenses: ProjectedExpense[];
}
