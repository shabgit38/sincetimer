import type { ExpenseItem } from "./expenseTypes";

type DefaultExpense = Pick<
  ExpenseItem,
  | "name"
  | "category"
  | "monthlyAmount"
  | "projectionBaseAmount"
  | "inflationRate"
  | "expenseType"
  | "essential"
  | "retirementIncluded"
>;

const defaultExpenses: DefaultExpense[] = [
  { name: "Electricity 1", category: "Utilities", monthlyAmount: 900, projectionBaseAmount: 1000, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Electricity 2", category: "Utilities", monthlyAmount: 100, projectionBaseAmount: 100, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Internet", category: "Internet", monthlyAmount: 1000, projectionBaseAmount: 1000, inflationRate: 6, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Phone", category: "Utilities", monthlyAmount: 500, projectionBaseAmount: 400, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Gas", category: "Utilities", monthlyAmount: 500, projectionBaseAmount: 400, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Property tax", category: "Housing", monthlyAmount: 500, projectionBaseAmount: 350, inflationRate: 7, expenseType: "housing", essential: true, retirementIncluded: true },
  { name: "Water", category: "Utilities", monthlyAmount: 500, projectionBaseAmount: 300, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Commute / travel", category: "Transport", monthlyAmount: 1000, projectionBaseAmount: 500, inflationRate: 7, expenseType: "discretionary", essential: false, retirementIncluded: true },
  { name: "Maintenance", category: "Housing", monthlyAmount: 3000, projectionBaseAmount: 3000, inflationRate: 7, expenseType: "housing", essential: true, retirementIncluded: true },
  { name: "Entertainment / subscriptions", category: "Lifestyle", monthlyAmount: 1000, projectionBaseAmount: 500, inflationRate: 7, expenseType: "discretionary", essential: false, retirementIncluded: true },
  { name: "Groceries", category: "Food", monthlyAmount: 15000, projectionBaseAmount: 8000, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Home improvement", category: "Housing", monthlyAmount: 1000, projectionBaseAmount: 500, inflationRate: 7, expenseType: "housing", essential: false, retirementIncluded: true },
  { name: "Learn / grow", category: "Education", monthlyAmount: 2000, projectionBaseAmount: 2000, inflationRate: 7, expenseType: "discretionary", essential: false, retirementIncluded: true },
  { name: "Personal", category: "Personal", monthlyAmount: 1000, projectionBaseAmount: 1000, inflationRate: 7, expenseType: "discretionary", essential: false, retirementIncluded: true },
  { name: "SIP", category: "Investments", monthlyAmount: 10000, projectionBaseAmount: 6000, inflationRate: 0, expenseType: "investment", essential: false, retirementIncluded: false },
  { name: "Lumpsum", category: "Investments", monthlyAmount: 10000, projectionBaseAmount: 6000, inflationRate: 0, expenseType: "investment", essential: false, retirementIncluded: false },
  { name: "Health", category: "Health", monthlyAmount: 10000, projectionBaseAmount: 3000, inflationRate: 9, expenseType: "health", essential: true, retirementIncluded: true },
  { name: "Emergency / unplanned", category: "Other", monthlyAmount: 10000, projectionBaseAmount: 3000, inflationRate: 7, expenseType: "irregular", essential: false, retirementIncluded: true },
  { name: "Loan / EMI", category: "Debt", monthlyAmount: 0, projectionBaseAmount: 0, inflationRate: 7, expenseType: "debt", essential: true, retirementIncluded: true },
  { name: "Item X", category: "Other", monthlyAmount: 0, projectionBaseAmount: 0, inflationRate: 7, expenseType: "irregular", essential: false, retirementIncluded: true },
  { name: "Rent", category: "Housing", monthlyAmount: 0, projectionBaseAmount: 0, inflationRate: 7, expenseType: "housing", essential: true, retirementIncluded: true },
];

export function createDefaultExpenses(startYear: number): ExpenseItem[] {
  return defaultExpenses.map((expense, index) => ({
    ...expense,
    id: `default-${index + 1}`,
    frequency: "monthly",
    startYear,
    notes: "",
    active: true,
  }));
}
