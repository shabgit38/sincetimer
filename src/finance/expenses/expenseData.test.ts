import { describe, expect, it } from "vitest";
import {
  addExpense,
  deleteExpense,
  updateExpense,
  validateExpense,
} from "./expenseData";
import { calculateCurrentBudget } from "./expenseCalculations";
import type { ExpenseItem } from "./expenseTypes";

function expense(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    id: "expense-1",
    name: "Groceries",
    category: "Groceries",
    monthlyAmount: 1000,
    frequency: "monthly",
    inflationRate: 0,
    expenseType: "essential",
    essential: true,
    retirementIncluded: true,
    startYear: 2026,
    notes: "",
    active: true,
    ...overrides,
  };
}

describe("expense data utilities", () => {
  it("adds an expense", () => {
    const original = expense();
    const added = expense({ id: "expense-2", name: "Internet" });

    expect(addExpense([original], added)).toEqual([added, original]);
  });

  it("edits an existing expense by id", () => {
    const original = expense();
    const edited = { ...original, name: "Monthly groceries", monthlyAmount: 1200 };

    expect(updateExpense([original], edited)).toEqual([edited]);
  });

  it("deletes an expense by id", () => {
    const original = expense();
    const other = expense({ id: "expense-2", name: "Internet" });

    expect(deleteExpense([original, other], original.id)).toEqual([other]);
  });

  it("rejects negative, non-finite, and invalid amounts", () => {
    expect(validateExpense(expense({ monthlyAmount: -1 }))).toMatch(/non-negative/);
    expect(validateExpense(expense({ monthlyAmount: Number.NaN }))).toMatch(/non-negative/);
    expect(validateExpense(expense({ monthlyAmount: Number.POSITIVE_INFINITY }))).toMatch(/non-negative/);
  });

  it("requires a supported category, frequency, and type", () => {
    expect(validateExpense(expense({ category: " " as ExpenseItem["category"] }))).toMatch(/category/);
    expect(validateExpense(expense({ category: "Unknown" as ExpenseItem["category"] }))).toMatch(/category/);
    expect(validateExpense(expense({ frequency: "weekly" as ExpenseItem["frequency"] }))).toMatch(/frequency/);
    expect(validateExpense(expense({ expenseType: "other" as ExpenseItem["expenseType"] }))).toMatch(/type/);
    expect(validateExpense(expense())).toBeNull();
  });

  it("separates monthly expenses, investments, and total cash outflow", () => {
    const budget = calculateCurrentBudget([
      expense({ monthlyAmount: 1200 }),
      expense({
        id: "investment",
        name: "SIP",
        category: "SIP",
        monthlyAmount: 500,
        expenseType: "investment",
        essential: false,
        retirementIncluded: false,
      }),
    ], 2026);

    expect(budget.totalCurrentLivingExpense.monthlyAmount).toBe(1200);
    expect(budget.totalInvestmentContribution.monthlyAmount).toBe(500);
    expect(budget.totalCurrentExpense.monthlyAmount).toBe(1700);
  });
});
