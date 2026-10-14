export type ExpenseFrequency = "monthly" | "weekly" | "biweekly" | "quarterly" | "annually" | "one-time";

export type ExpenseType =
  | "essential"
  | "discretionary"
  | "health"
  | "housing"
  | "irregular"
  | "debt"
  | "investment";

export interface ExpenseItem {
  id: string;
  name: string;
  category: string;
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
