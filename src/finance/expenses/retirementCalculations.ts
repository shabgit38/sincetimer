import {
  addExpenseAmounts,
  createEmptyExpenseTotals,
  projectExpenseToYear,
} from "./expenseCalculations";
import type {
  ExpenseItem,
  ProjectedExpense,
  RetirementExpenseSummary,
} from "./expenseTypes";

export function calculateRetirementExpenses(
  expenses: readonly ExpenseItem[],
  retirementYear: number,
  baseYear: number,
): RetirementExpenseSummary {
  const eligibleExpenses: ProjectedExpense[] = [];
  let retirementEligibleExpense = createEmptyExpenseTotals();

  for (const expense of expenses) {
    if (!expense.retirementIncluded || expense.expenseType === "investment") continue;
    const projectedExpense = projectExpenseToYear(expense, retirementYear, baseYear);
    if (!projectedExpense) continue;

    eligibleExpenses.push(projectedExpense);
    retirementEligibleExpense = addExpenseAmounts(retirementEligibleExpense, {
      monthlyAmount: projectedExpense.projectedMonthlyAmount,
      annualAmount: projectedExpense.projectedAnnualAmount,
    });
  }

  const summary: RetirementExpenseSummary = {
    retirementEligibleExpense,
    essentialExpense: createEmptyExpenseTotals(),
    discretionaryExpense: createEmptyExpenseTotals(),
    healthExpense: createEmptyExpenseTotals(),
    irregularExpense: createEmptyExpenseTotals(),
    expenses: eligibleExpenses,
  };

  for (const expense of eligibleExpenses) {
    const amounts = {
      monthlyAmount: expense.projectedMonthlyAmount,
      annualAmount: expense.projectedAnnualAmount,
    };
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

export function calculateRequiredRetirementCorpus(annualExpense: number, withdrawalRatePercent: number): number {
  if (!Number.isFinite(annualExpense) || annualExpense < 0) {
    throw new RangeError("Annual retirement expense must be finite and non-negative.");
  }
  if (!Number.isFinite(withdrawalRatePercent) || withdrawalRatePercent <= 0) {
    throw new RangeError("Withdrawal rate must be finite and greater than zero.");
  }
  const requiredCorpus = annualExpense / (withdrawalRatePercent / 100);
  if (!Number.isFinite(requiredCorpus)) {
    throw new RangeError("Required retirement corpus exceeds the supported numeric range.");
  }
  return requiredCorpus;
}
