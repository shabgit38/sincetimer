import { describe, expect, it } from "vitest";
import {
  calculateCurrentBudget,
  calculateExpenseAmounts,
  calculateFutureExpenseProjection,
  calculateMonthlySurplus,
  projectExpenseToYear,
} from "./expenseCalculations";
import { calculateRequiredRetirementCorpus, calculateRetirementExpenses } from "./retirementCalculations";
import type { ExpenseItem } from "./expenseTypes";
import { createDefaultExpenses } from "./defaultExpenses";

function expense(overrides: Partial<ExpenseItem> = {}): ExpenseItem {
  return {
    id: "expense-1",
    name: "Rent",
    category: "Rent",
    monthlyAmount: 1000,
    frequency: "monthly",
    inflationRate: 5,
    expenseType: "housing",
    essential: true,
    retirementIncluded: true,
    startYear: 2025,
    notes: "",
    active: true,
    ...overrides,
  };
}

describe("expense calculations", () => {
  it("returns zero amounts for a zero expense", () => {
    expect(calculateExpenseAmounts(expense({ monthlyAmount: 0 }))).toEqual({
      monthlyAmount: 0,
      annualAmount: 0,
    });
  });

  it("calculates a normal monthly expense", () => {
    expect(calculateExpenseAmounts(expense({ monthlyAmount: 1250 }))).toEqual({
      monthlyAmount: 1250,
      annualAmount: 15000,
    });
  });

  it("annualizes expenses whose frequency is not monthly", () => {
    expect(calculateExpenseAmounts(expense({ frequency: "annual", monthlyAmount: 12000 }))).toEqual({
      monthlyAmount: 1000,
      annualAmount: 12000,
    });
    expect(calculateExpenseAmounts(expense({ frequency: "half-yearly", monthlyAmount: 600 }))).toEqual({
      monthlyAmount: 100,
      annualAmount: 1200,
    });
  });

  it("rejects negative amounts and inflation", () => {
    expect(() => calculateExpenseAmounts(expense({ monthlyAmount: -1 }))).toThrow(RangeError);
    expect(() => projectExpenseToYear(expense({ inflationRate: -1 }), 2027, 2025)).toThrow(RangeError);
  });

  it("includes investment contributions in current outflows but excludes them from living and retirement expenses", () => {
    const investment = expense({
      id: "sip",
      name: "SIP",
      category: "SIP",
      monthlyAmount: 500,
      expenseType: "investment",
      essential: false,
    });
    const current = calculateCurrentBudget([investment], 2025);
    const retirement = calculateRetirementExpenses([investment], 2040, 2025);

    expect(current.totalCurrentExpense.monthlyAmount).toBe(500);
    expect(current.totalInvestmentContribution.monthlyAmount).toBe(500);
    expect(current.totalCurrentLivingExpense.monthlyAmount).toBe(0);
    expect(retirement.retirementEligibleExpense.annualAmount).toBe(0);
  });

  it("excludes expenses with retirementIncluded set to false", () => {
    const result = calculateRetirementExpenses(
      [expense({ retirementIncluded: false })],
      2040,
      2025,
    );

    expect(result.retirementEligibleExpense.annualAmount).toBe(0);
  });

  it("includes expenses with retirementIncluded set to true", () => {
    const result = calculateRetirementExpenses(
      [expense({ monthlyAmount: 1000, retirementIncluded: true })],
      2025,
      2025,
    );

    expect(result.retirementEligibleExpense.monthlyAmount).toBe(1000);
  });

  it("excludes expenses that ended before retirement", () => {
    const result = calculateRetirementExpenses(
      [expense({ endYear: 2035 })],
      2040,
      2025,
    );

    expect(result.retirementEligibleExpense.annualAmount).toBe(0);
  });

  it("applies the expense-specific inflation rate without rounding intermediate values", () => {
    const projected = projectExpenseToYear(
      expense({ category: "Electricity", monthlyAmount: 100, inflationRate: 10 }),
      2027,
      2025,
    );

    expect(projected?.projectedAnnualAmount).toBeCloseTo(1200 * 1.1 ** 2);
    expect(projected?.appliedInflationRate).toBe(10);
  });

  it("allows different annual inflation rates for expenses in the same category", () => {
    const utilityA = expense({ id: "power", category: "Electricity", monthlyAmount: 100, inflationRate: 5 });
    const utilityB = expense({ id: "internet", category: "Electricity", monthlyAmount: 100, inflationRate: 9 });

    const projectedA = projectExpenseToYear(utilityA, 2027, 2025);
    const projectedB = projectExpenseToYear(utilityB, 2027, 2025);

    expect(projectedA?.projectedAnnualAmount).toBeCloseTo(1200 * 1.05 ** 2);
    expect(projectedB?.projectedAnnualAmount).toBeCloseTo(1200 * 1.09 ** 2);
  });

  it("projects an editable forecast base amount from its base year", () => {
    const projected = projectExpenseToYear(
      expense({ monthlyAmount: 900, projectionBaseAmount: 1000, inflationRate: 10 }),
      2027,
      2026,
    );

    expect(projected?.projectedAnnualAmount).toBeCloseTo(12000 * 1.1);
  });

  it("calculates future totals and investment contributions separately", () => {
    const projection = calculateFutureExpenseProjection(
      [
        expense({ monthlyAmount: 100, projectionBaseAmount: 200, category: "Rent", inflationRate: 10 }),
        expense({
          id: "investment",
          monthlyAmount: 50,
          projectionBaseAmount: 25,
          category: "SIP",
          inflationRate: 0,
          expenseType: "investment",
          essential: false,
          retirementIncluded: false,
        }),
      ],
      2027,
      2026,
    );

    expect(projection.projectedLivingExpense.monthlyAmount).toBeCloseTo(220);
    expect(projection.projectedInvestmentContribution.monthlyAmount).toBe(25);
    expect(projection.totalProjectedExpense.monthlyAmount).toBeCloseTo(245);
  });

  it("calculates budget surplus only when income is available", () => {
    expect(calculateMonthlySurplus(null, 100)).toBeNull();
    expect(calculateMonthlySurplus(1000, 300)).toBe(700);
  });

  it("calculates the retirement corpus using the withdrawal rate", () => {
    expect(calculateRequiredRetirementCorpus(120000, 4)).toBe(3000000);
  });

  it("seeds the sample spreadsheet expenses and forecast-year amounts", () => {
    const sample = createDefaultExpenses(2026);
    const budget = calculateCurrentBudget(sample, 2026);
    const projection = calculateFutureExpenseProjection(sample, 2026, 2026);

    expect(budget.totalCurrentLivingExpense.monthlyAmount).toBe(48000);
    expect(budget.totalInvestmentContribution.monthlyAmount).toBe(20000);
    expect(budget.totalCurrentExpense.monthlyAmount).toBe(68000);
    expect(projection.totalProjectedExpense.monthlyAmount).toBe(37050);
  });

  it("sums multiple expenses by budget classification", () => {
    const result = calculateCurrentBudget([
      expense({ id: "essential", monthlyAmount: 1000 }),
      expense({
        id: "discretionary",
        monthlyAmount: 200,
        expenseType: "discretionary",
        essential: false,
      }),
      expense({
        id: "health",
        monthlyAmount: 100,
        expenseType: "health",
        category: "Health",
      }),
      expense({
        id: "irregular",
        monthlyAmount: 50,
        expenseType: "irregular",
        category: "Travel",
        frequency: "annual",
        essential: false,
      }),
      expense({
        id: "investment",
        monthlyAmount: 300,
        expenseType: "investment",
        category: "SIP",
        essential: false,
      }),
    ], 2025);

    expect(result.totalCurrentExpense.annualAmount).toBe(19250);
    expect(result.totalCurrentLivingExpense.annualAmount).toBe(15650);
    expect(result.totalInvestmentContribution.annualAmount).toBe(3600);
    expect(result.essentialExpense.annualAmount).toBe(13200);
    expect(result.discretionaryExpense.annualAmount).toBe(2400);
    expect(result.healthExpense.annualAmount).toBe(1200);
    expect(result.irregularExpense.annualAmount).toBe(50);
  });
});
