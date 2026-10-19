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
  { name: "Electricity", category: "Electricity", monthlyAmount: 900, projectionBaseAmount: 1000, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Electricity", category: "Electricity", monthlyAmount: 100, projectionBaseAmount: 100, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Internet", category: "Internet", monthlyAmount: 1000, projectionBaseAmount: 1000, inflationRate: 6, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Mobile", category: "Mobile", monthlyAmount: 500, projectionBaseAmount: 400, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Gas", category: "Gas", monthlyAmount: 500, projectionBaseAmount: 400, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Property tax", category: "Rent", monthlyAmount: 500, projectionBaseAmount: 350, inflationRate: 7, expenseType: "housing", essential: true, retirementIncluded: true },
  { name: "Water", category: "Water", monthlyAmount: 500, projectionBaseAmount: 300, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Commute / travel", category: "Travel", monthlyAmount: 1000, projectionBaseAmount: 500, inflationRate: 7, expenseType: "discretionary", essential: false, retirementIncluded: true },
  { name: "Maintenance", category: "Maintenance", monthlyAmount: 3000, projectionBaseAmount: 3000, inflationRate: 7, expenseType: "housing", essential: true, retirementIncluded: true },
  { name: "Entertainment", category: "Entertainment", monthlyAmount: 1000, projectionBaseAmount: 500, inflationRate: 7, expenseType: "discretionary", essential: false, retirementIncluded: true },
  { name: "Groceries", category: "Groceries", monthlyAmount: 15000, projectionBaseAmount: 8000, inflationRate: 7, expenseType: "essential", essential: true, retirementIncluded: true },
  { name: "Home improvement", category: "Home Improvement", monthlyAmount: 1000, projectionBaseAmount: 500, inflationRate: 7, expenseType: "housing", essential: false, retirementIncluded: true },
  { name: "Learn / grow", category: "Learning", monthlyAmount: 2000, projectionBaseAmount: 2000, inflationRate: 7, expenseType: "discretionary", essential: false, retirementIncluded: true },
  { name: "Personal", category: "Personal", monthlyAmount: 1000, projectionBaseAmount: 1000, inflationRate: 7, expenseType: "discretionary", essential: false, retirementIncluded: true },
  { name: "SIP", category: "SIP", monthlyAmount: 10000, projectionBaseAmount: 6000, inflationRate: 0, expenseType: "investment", essential: false, retirementIncluded: false },
  { name: "Lumpsum Investment", category: "Lumpsum Investment", monthlyAmount: 10000, projectionBaseAmount: 6000, inflationRate: 0, expenseType: "investment", essential: false, retirementIncluded: false },
  { name: "Health", category: "Health", monthlyAmount: 10000, projectionBaseAmount: 3000, inflationRate: 9, expenseType: "health", essential: true, retirementIncluded: true },
  { name: "Emergency / unplanned", category: "Emergency / Unplanned", monthlyAmount: 10000, projectionBaseAmount: 3000, inflationRate: 7, expenseType: "irregular", essential: false, retirementIncluded: true },
  { name: "Loan / EMI", category: "EMI / Loan", monthlyAmount: 0, projectionBaseAmount: 0, inflationRate: 7, expenseType: "debt", essential: true, retirementIncluded: true },
  { name: "Item X", category: "Other", monthlyAmount: 0, projectionBaseAmount: 0, inflationRate: 7, expenseType: "irregular", essential: false, retirementIncluded: true },
  { name: "Rent", category: "Rent", monthlyAmount: 0, projectionBaseAmount: 0, inflationRate: 7, expenseType: "housing", essential: true, retirementIncluded: true },
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
