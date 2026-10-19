import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  addExpense,
  createExpenseItem,
  deleteExpense,
  updateExpense,
  validateExpense,
} from "@/finance/expenses/expenseData";
import { createDefaultExpenses } from "@/finance/expenses/defaultExpenses";
import { calculateCurrentBudget, calculateExpenseAmounts } from "@/finance/expenses/expenseCalculations";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_FREQUENCIES,
  EXPENSE_TYPES,
} from "@/finance/expenses/expenseTypes";
import type { ExpenseCategory, ExpenseFrequency, ExpenseItem, ExpenseType } from "@/finance/expenses/expenseTypes";

const currentYear = new Date().getFullYear();
const occurrencesPerYear: Record<ExpenseFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  "half-yearly": 2,
  annual: 1,
  "one-time": 1,
};
const inputClass =
  "h-9 min-w-0 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-700 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10";
const formatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

function formatMoney(value: number) {
  return formatter.format(value);
}

function formatLabel(value: string) {
  if (value === "one-time") return "One-time";
  if (value === "half-yearly") return "Half-yearly";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function ExpensePlanner() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => createDefaultExpenses(currentYear));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseItem | null>(null);
  const [isNewExpense, setIsNewExpense] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const budget = useMemo(() => calculateCurrentBudget(expenses, currentYear), [expenses]);

  const beginAdd = () => {
    const expense = createExpenseItem(crypto.randomUUID(), currentYear);
    setExpenses((current) => addExpense(current, expense));
    setEditingId(expense.id);
    setDraft(expense);
    setIsNewExpense(true);
    setError(null);
  };

  const beginEdit = (expense: ExpenseItem) => {
    setEditingId(expense.id);
    setDraft({ ...expense });
    setIsNewExpense(false);
    setError(null);
  };

  const cancelEdit = () => {
    if (isNewExpense && editingId) {
      setExpenses((current) => deleteExpense(current, editingId));
    }
    setEditingId(null);
    setDraft(null);
    setIsNewExpense(false);
    setError(null);
  };

  const updateDraft = <K extends keyof ExpenseItem>(key: K, value: ExpenseItem[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const setMonthlyAmount = (value: number) => {
    setDraft((current) => {
      if (!current || !Number.isFinite(value)) return current;
      const amountPerOccurrence = value * 12 / occurrencesPerYear[current.frequency];
      if (!Number.isFinite(amountPerOccurrence) ||
        !Number.isFinite(amountPerOccurrence * occurrencesPerYear[current.frequency])) return current;
      return { ...current, monthlyAmount: amountPerOccurrence };
    });
  };

  const setFrequency = (frequency: ExpenseFrequency) => {
    setDraft((current) => {
      if (!current || !Number.isFinite(current.monthlyAmount) || current.monthlyAmount < 0) return current;
      const monthlyEquivalent = calculateExpenseAmounts(current).monthlyAmount;
      const monthlyAmount = monthlyEquivalent * 12 / occurrencesPerYear[frequency];
      if (!Number.isFinite(monthlyAmount)) return current;
      return { ...current, frequency, monthlyAmount };
    });
  };

  const saveExpense = () => {
    if (!draft) return;
    const validationError = validateExpense(draft);
    if (validationError) {
      setError(validationError);
      return;
    }
    try {
      calculateExpenseAmounts(draft);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Enter a valid amount.");
      return;
    }
    const savedExpense = {
      ...draft,
      name: draft.name.trim(),
    };
    setExpenses((current) => updateExpense(current, savedExpense));
    setEditingId(null);
    setDraft(null);
    setIsNewExpense(false);
    setError(null);
  };

  const removeExpense = (expenseId: string) => {
    setExpenses((current) => deleteExpense(current, expenseId));
    if (editingId === expenseId) {
      setEditingId(null);
      setDraft(null);
      setIsNewExpense(false);
      setError(null);
    }
  };

  const toggleActive = (expense: ExpenseItem) => {
    setExpenses((current) => updateExpense(current, { ...expense, active: !expense.active }));
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-stone-950 dark:text-stone-50">Expense Planner</h2>
        <button
          type="button"
          disabled={editingId !== null}
          onClick={beginAdd}
          className="rounded-lg bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white"
        >
          Add expense
        </button>
      </header>

      {error && editingId ? <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{error}</p> : null}

      <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] border-collapse text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900 dark:text-stone-400">
              <tr>
                <th className="px-3 py-2">Expense</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Monthly amount</th>
                <th className="px-3 py-2">Frequency</th>
                <th className="px-3 py-2">Expense type</th>
                <th className="px-3 py-2 text-center">Essential?</th>
                <th className="px-3 py-2 text-center">Retirement included?</th>
                <th className="px-3 py-2 text-center">Active?</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => {
                const isEditing = editingId === expense.id && draft !== null;
                const row = isEditing ? draft : expense;
                const monthlyAmount = isEditing
                  ? row.monthlyAmount * occurrencesPerYear[row.frequency] / 12
                  : calculateExpenseAmounts(row).monthlyAmount;

                return (
                  <tr key={expense.id} className={`border-t border-stone-100 align-middle dark:border-white/10 ${expense.active ? "" : "opacity-55"}`}>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          aria-label="Expense name"
                          className={`${inputClass} w-36`}
                          value={row.name}
                          onChange={(event) => updateDraft("name", event.currentTarget.value)}
                        />
                      ) : <span className="font-medium text-stone-900 dark:text-stone-100">{expense.name}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          aria-label="Category"
                          className={`${inputClass} w-40`}
                          value={row.category}
                          onChange={(event) => updateDraft("category", event.currentTarget.value as ExpenseCategory)}
                        >
                          {EXPENSE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                      ) : expense.category}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          aria-label="Monthly amount"
                          type="number"
                          min="0"
                          step="100"
                          className={`${inputClass} w-32 text-right`}
                          value={Number.isFinite(monthlyAmount) ? monthlyAmount : ""}
                          onChange={(event) => {
                            const value = event.currentTarget.valueAsNumber;
                            if (Number.isFinite(value)) setMonthlyAmount(value);
                          }}
                        />
                      ) : formatMoney(monthlyAmount)}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          aria-label="Frequency"
                          className={`${inputClass} w-32`}
                          value={row.frequency}
                          onChange={(event) => setFrequency(event.currentTarget.value as ExpenseFrequency)}
                        >
                          {EXPENSE_FREQUENCIES.map((frequency) => <option key={frequency} value={frequency}>{formatLabel(frequency)}</option>)}
                        </select>
                      ) : formatLabel(expense.frequency)}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <select
                          aria-label="Expense type"
                          className={`${inputClass} w-36`}
                          value={row.expenseType}
                          onChange={(event) => {
                            const expenseType = event.currentTarget.value as ExpenseType;
                            updateDraft("expenseType", expenseType);
                          }}
                        >
                          {EXPENSE_TYPES.map((type) => <option key={type} value={type}>{formatLabel(type)}</option>)}
                        </select>
                      ) : formatLabel(expense.expenseType)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        aria-label={`${row.name || "Expense"} is essential`}
                        type="checkbox"
                        checked={row.essential}
                        disabled={!isEditing}
                        onChange={(event) => updateDraft("essential", event.currentTarget.checked)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        aria-label={`Include ${row.name || "expense"} in retirement`}
                        type="checkbox"
                        checked={row.retirementIncluded}
                        disabled={!isEditing}
                        onChange={(event) => updateDraft("retirementIncluded", event.currentTarget.checked)}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        aria-label={`${expense.name} active`}
                        type="checkbox"
                        checked={expense.active}
                        disabled={isEditing}
                        onChange={() => toggleActive(expense)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <input
                          aria-label="Notes"
                          className={`${inputClass} w-40`}
                          value={row.notes}
                          onChange={(event) => updateDraft("notes", event.currentTarget.value)}
                        />
                      ) : <span className="block max-w-40 truncate" title={expense.notes}>{expense.notes || "—"}</span>}
                    </td>
                    <td className="px-3 py-2">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button type="button" onClick={saveExpense} className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">Save</button>
                          <button type="button" onClick={cancelEdit} className="rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/[0.06]">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            disabled={editingId !== null}
                            onClick={() => beginEdit(expense)}
                            className="grid h-7 w-7 place-items-center rounded-md text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:text-sky-200 dark:hover:bg-sky-400/10"
                            aria-label={`Edit ${expense.name}`}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={editingId !== null}
                            onClick={() => removeExpense(expense.id)}
                            className="grid h-7 w-7 place-items-center rounded-md text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-200 dark:hover:bg-rose-400/10"
                            aria-label={`Delete ${expense.name}`}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {expenses.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-stone-500">No expenses yet. Add one to begin.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-label="Monthly totals" className="grid gap-2 sm:grid-cols-3">
        <article className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Total monthly expenses</h3>
          <p className="mt-1 text-lg font-semibold text-stone-950 dark:text-stone-50">{formatMoney(budget.totalCurrentLivingExpense.monthlyAmount)}</p>
        </article>
        <article className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Total monthly investments</h3>
          <p className="mt-1 text-lg font-semibold text-stone-950 dark:text-stone-50">{formatMoney(budget.totalInvestmentContribution.monthlyAmount)}</p>
        </article>
        <article className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-xs font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">Total monthly cash outflow</h3>
          <p className="mt-1 text-lg font-semibold text-stone-950 dark:text-stone-50">{formatMoney(budget.totalCurrentExpense.monthlyAmount)}</p>
        </article>
      </section>
    </div>
  );
}

export default ExpensePlanner;
