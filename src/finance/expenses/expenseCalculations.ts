import type {
  CurrentBudgetSummary,
  ExpenseAmounts,
  ExpenseFrequency,
  ExpenseItem,
  ExpenseTotals,
  FutureExpenseProjection,
  ProjectedExpense,
} from "./expenseTypes";
import { EXPENSE_FREQUENCIES, EXPENSE_TYPES } from "./expenseTypes";

const occurrencesPerYear: Record<ExpenseFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  "half-yearly": 2,
  annual: 1,
  "one-time": 1,
};

function assertValidExpense(expense: ExpenseItem) {
  if (!EXPENSE_FREQUENCIES.includes(expense.frequency) || !EXPENSE_TYPES.includes(expense.expenseType)) {
    throw new RangeError(`Expense "${expense.name}" has an unsupported frequency or type.`);
  }
  if (!Number.isFinite(expense.monthlyAmount) || expense.monthlyAmount < 0) {
    throw new RangeError(`Expense "${expense.name}" must have a finite, non-negative amount.`);
  }
  if (expense.projectionBaseAmount !== undefined &&
    (!Number.isFinite(expense.projectionBaseAmount) || expense.projectionBaseAmount < 0)) {
    throw new RangeError(`Expense "${expense.name}" must have a finite, non-negative forecast amount.`);
  }
  if (!Number.isFinite(expense.inflationRate) || expense.inflationRate < 0) {
    throw new RangeError(`Expense "${expense.name}" must have a finite, non-negative inflation rate.`);
  }
  if (!Number.isInteger(expense.startYear) || (expense.endYear !== undefined && !Number.isInteger(expense.endYear))) {
    throw new RangeError(`Expense "${expense.name}" must have whole-number start and end years.`);
  }
  if (expense.endYear !== undefined && expense.endYear < expense.startYear) {
    throw new RangeError(`Expense "${expense.name}" cannot end before it starts.`);
  }
}

export function calculateExpenseAmounts(expense: ExpenseItem): ExpenseAmounts {
  assertValidExpense(expense);
  const annualAmount = expense.monthlyAmount * occurrencesPerYear[expense.frequency];
  if (!Number.isFinite(annualAmount)) {
    throw new RangeError(`Annual amount for "${expense.name}" exceeds the supported numeric range.`);
  }
  return {
    monthlyAmount: annualAmount / 12,
    annualAmount,
  };
}

export function isExpenseActiveInYear(expense: ExpenseItem, year: number): boolean {
  assertValidExpense(expense);
  if (!Number.isInteger(year)) throw new RangeError("Expense year must be a whole number.");
  if (!expense.active || year < expense.startYear || (expense.endYear !== undefined && year > expense.endYear)) {
    return false;
  }
  return expense.frequency !== "one-time" || year === expense.startYear;
}

export function projectExpenseToYear(
  expense: ExpenseItem,
  targetYear: number,
  baseYear: number,
): ProjectedExpense | null {
  assertValidExpense(expense);
  if (!Number.isInteger(targetYear) || !Number.isInteger(baseYear)) {
    throw new RangeError("Projection years must be whole numbers.");
  }
  if (!isExpenseActiveInYear(expense, targetYear)) return null;

  const appliedInflationRate = expense.inflationRate;
  if (!Number.isFinite(appliedInflationRate) || appliedInflationRate < 0) {
    throw new RangeError(`Inflation for category "${expense.category}" must be finite and non-negative.`);
  }
  const projectionYears = Math.max(0, targetYear - baseYear);
  const projectionBaseExpense = expense.projectionBaseAmount === undefined
    ? expense
    : { ...expense, monthlyAmount: expense.projectionBaseAmount };
  const currentAmounts = calculateExpenseAmounts(projectionBaseExpense);
  const inflationFactor = (1 + appliedInflationRate / 100) ** projectionYears;
  const annualAmount = currentAmounts.annualAmount * inflationFactor;
  if (!Number.isFinite(annualAmount)) {
    throw new RangeError(`Projected amount for "${expense.name}" exceeds the supported numeric range.`);
  }

  return {
    ...expense,
    projectedMonthlyAmount: annualAmount / 12,
    projectedAnnualAmount: annualAmount,
    appliedInflationRate,
    projectionYears,
  };
}

export function createEmptyExpenseTotals(): ExpenseTotals {
  return { monthlyAmount: 0, annualAmount: 0 };
}

export function addExpenseAmounts(total: ExpenseTotals, amounts: ExpenseAmounts): ExpenseTotals {
  const result = {
    monthlyAmount: total.monthlyAmount + amounts.monthlyAmount,
    annualAmount: total.annualAmount + amounts.annualAmount,
  };
  if (!Number.isFinite(result.monthlyAmount) || !Number.isFinite(result.annualAmount)) {
    throw new RangeError("Expense total exceeds the supported numeric range.");
  }
  return result;
}

export function calculateCurrentBudget(expenses: readonly ExpenseItem[], currentYear: number): CurrentBudgetSummary {
  if (!Number.isInteger(currentYear)) throw new RangeError("Current year must be a whole number.");

  const summary: CurrentBudgetSummary = {
    totalCurrentExpense: createEmptyExpenseTotals(),
    totalCurrentLivingExpense: createEmptyExpenseTotals(),
    totalInvestmentContribution: createEmptyExpenseTotals(),
    essentialExpense: createEmptyExpenseTotals(),
    discretionaryExpense: createEmptyExpenseTotals(),
    healthExpense: createEmptyExpenseTotals(),
    irregularExpense: createEmptyExpenseTotals(),
  };

  for (const expense of expenses) {
    if (!isExpenseActiveInYear(expense, currentYear)) continue;
    const amounts = calculateExpenseAmounts(expense);
    summary.totalCurrentExpense = addExpenseAmounts(summary.totalCurrentExpense, amounts);

    if (expense.expenseType === "investment") {
      summary.totalInvestmentContribution = addExpenseAmounts(summary.totalInvestmentContribution, amounts);
      continue;
    }
    summary.totalCurrentLivingExpense = addExpenseAmounts(summary.totalCurrentLivingExpense, amounts);
    if (expense.essential) summary.essentialExpense = addExpenseAmounts(summary.essentialExpense, amounts);
    if (expense.expenseType === "discretionary") {
      summary.discretionaryExpense = addExpenseAmounts(summary.discretionaryExpense, amounts);
    }
    if (expense.expenseType === "health") summary.healthExpense = addExpenseAmounts(summary.healthExpense, amounts);
    if (expense.expenseType === "irregular") {
      summary.irregularExpense = addExpenseAmounts(summary.irregularExpense, amounts);
    }
  }

  return summary;
}

export function calculateMonthlySurplus(income: number | null, monthlyOutflow: number): number | null {
  if (income === null) return null;
  if (!Number.isFinite(income) || income < 0 || !Number.isFinite(monthlyOutflow) || monthlyOutflow < 0) {
    throw new RangeError("Income and monthly outflow must be finite, non-negative amounts.");
  }
  return income - monthlyOutflow;
}

export function calculateFutureExpenseProjection(
  expenses: readonly ExpenseItem[],
  targetYear: number,
  baseYear: number,
): FutureExpenseProjection {
  if (!Number.isInteger(targetYear) || !Number.isInteger(baseYear)) {
    throw new RangeError("Projection years must be whole numbers.");
  }

  const summary: FutureExpenseProjection = {
    totalProjectedExpense: createEmptyExpenseTotals(),
    projectedLivingExpense: createEmptyExpenseTotals(),
    projectedInvestmentContribution: createEmptyExpenseTotals(),
    essentialExpense: createEmptyExpenseTotals(),
    discretionaryExpense: createEmptyExpenseTotals(),
    healthExpense: createEmptyExpenseTotals(),
    irregularExpense: createEmptyExpenseTotals(),
    expenses: [],
  };

  for (const expense of expenses) {
    const projectedExpense = projectExpenseToYear(expense, targetYear, baseYear);
    if (!projectedExpense) continue;

    const amounts = {
      monthlyAmount: projectedExpense.projectedMonthlyAmount,
      annualAmount: projectedExpense.projectedAnnualAmount,
    };
    summary.expenses.push(projectedExpense);
    summary.totalProjectedExpense = addExpenseAmounts(summary.totalProjectedExpense, amounts);
    if (expense.expenseType === "investment") {
      summary.projectedInvestmentContribution = addExpenseAmounts(summary.projectedInvestmentContribution, amounts);
      continue;
    }

    summary.projectedLivingExpense = addExpenseAmounts(summary.projectedLivingExpense, amounts);
    if (expense.essential) summary.essentialExpense = addExpenseAmounts(summary.essentialExpense, amounts);
    if (expense.expenseType === "discretionary") {
      summary.discretionaryExpense = addExpenseAmounts(summary.discretionaryExpense, amounts);
    }
    if (expense.expenseType === "health") summary.healthExpense = addExpenseAmounts(summary.healthExpense, amounts);
    if (expense.expenseType === "irregular") {
      summary.irregularExpense = addExpenseAmounts(summary.irregularExpense, amounts);
    }
  }

  return summary;
}
