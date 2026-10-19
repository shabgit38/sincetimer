import {
  EXPENSE_CATEGORIES,
  EXPENSE_FREQUENCIES,
  EXPENSE_TYPES,
} from "./expenseTypes";
import type { ExpenseItem } from "./expenseTypes";

export function createExpenseItem(id: string, startYear: number): ExpenseItem {
  return {
    id,
    name: "",
    category: "Other",
    monthlyAmount: 0,
    frequency: "monthly",
    inflationRate: 7,
    expenseType: "discretionary",
    essential: false,
    retirementIncluded: true,
    startYear,
    notes: "",
    active: true,
  };
}

export function validateExpense(expense: ExpenseItem): string | null {
  if (!Number.isFinite(expense.monthlyAmount) || expense.monthlyAmount < 0) {
    return "Amount must be a valid non-negative number.";
  }
  if (!EXPENSE_CATEGORIES.some((category) => category === expense.category)) {
    return "Choose a supported category.";
  }
  if (!EXPENSE_FREQUENCIES.includes(expense.frequency)) {
    return "Choose a supported frequency.";
  }
  if (!EXPENSE_TYPES.includes(expense.expenseType)) {
    return "Choose a supported expense type.";
  }
  return null;
}

export function addExpense(expenses: readonly ExpenseItem[], expense: ExpenseItem): ExpenseItem[] {
  return [expense, ...expenses];
}

export function updateExpense(expenses: readonly ExpenseItem[], updatedExpense: ExpenseItem): ExpenseItem[] {
  return expenses.map((expense) => expense.id === updatedExpense.id ? updatedExpense : expense);
}

export function deleteExpense(expenses: readonly ExpenseItem[], expenseId: string): ExpenseItem[] {
  return expenses.filter((expense) => expense.id !== expenseId);
}
