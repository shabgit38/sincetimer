import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  calculateCurrentBudget,
  calculateExpenseAmounts,
  calculateFutureExpenseProjection,
  calculateMonthlySurplus,
} from "@/finance/expenses/expenseCalculations";
import { createDefaultExpenses } from "@/finance/expenses/defaultExpenses";
import { calculateRequiredRetirementCorpus, calculateRetirementExpenses } from "@/finance/expenses/retirementCalculations";
import type {
  ExpenseFrequency,
  ExpenseItem,
  ExpenseType,
} from "@/finance/expenses/expenseTypes";

type PlannerSection = "current-budget" | "future-projection" | "retirement";

const currentYear = new Date().getFullYear();
const occurrencesPerYear: Record<ExpenseFrequency, number> = {
  monthly: 12,
  weekly: 52,
  biweekly: 26,
  quarterly: 4,
  annually: 1,
  "one-time": 1,
};
const expenseTypes: ExpenseType[] = [
  "essential",
  "discretionary",
  "health",
  "housing",
  "irregular",
  "debt",
  "investment",
];
const frequencies: ExpenseFrequency[] = ["monthly", "weekly", "biweekly", "quarterly", "annually", "one-time"];
const inputClass =
  "h-9 min-w-0 rounded-lg border border-stone-300 bg-white px-2 text-sm text-stone-700 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10";
const cardClass = "rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04]";
const formatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

function formatMoney(value: number) {
  return formatter.format(value);
}

function formatType(value: ExpenseType) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className={`${cardClass} p-2.5`}>
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold leading-tight text-stone-950 dark:text-stone-50">{value}</p>
      {detail ? <p className="mt-0.5 text-[11px] text-stone-500 dark:text-stone-400">{detail}</p> : null}
    </article>
  );
}

function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="grid gap-1 text-xs font-medium text-stone-500 dark:text-stone-400">
      {label}
      <input
        type="number"
        min={min}
        step={step}
        className={inputClass}
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;
          if (Number.isFinite(nextValue) && nextValue >= min && (step !== 1 || Number.isInteger(nextValue))) onChange(nextValue);
        }}
      />
    </label>
  );
}

function makeNewExpense(expenseType: ExpenseType = "discretionary"): ExpenseItem {
  return {
    id: crypto.randomUUID(),
    name: "",
    category: "",
    monthlyAmount: 0,
    frequency: "monthly",
    inflationRate: expenseType === "health" ? 9 : 7,
    expenseType,
    essential: expenseType === "essential" || expenseType === "health" || expenseType === "housing" || expenseType === "debt",
    retirementIncluded: expenseType !== "investment",
    startYear: currentYear,
    notes: "",
    active: true,
  };
}

function ExpenseTable({
  expenses,
  investment = false,
  editingId,
  draft,
  error,
  onAdd,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  onToggleActive,
  onDraftChange,
  onMonthlyChange,
  onFrequencyChange,
  onCurrentMonthlyChange,
  addDisabled,
}: {
  expenses: ExpenseItem[];
  investment?: boolean;
  editingId: string | null;
  draft: ExpenseItem | null;
  error: string | null;
  onAdd: () => void;
  onEdit: (expense: ExpenseItem) => void;
  onCancel: () => void;
  onSave: () => void;
  onDelete: (expenseId: string) => void;
  onToggleActive: (expense: ExpenseItem) => void;
  onDraftChange: <K extends keyof ExpenseItem>(key: K, value: ExpenseItem[K]) => void;
  onMonthlyChange: (monthlyEquivalent: number) => void;
  onFrequencyChange: (frequency: ExpenseFrequency) => void;
  onCurrentMonthlyChange: (expense: ExpenseItem, monthlyEquivalent: number) => void;
  addDisabled: boolean;
}) {
  const rows = expenses.filter((expense) => (expense.expenseType === "investment") === investment);

  return (
    <section className={`${cardClass} overflow-hidden p-0`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-white/10">
        <div>
          <h3 className="font-semibold text-stone-950 dark:text-stone-50">{investment ? "Investments" : "Living expenses"}</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {investment ? "Cash outflows for SIPs and other investment contributions." : "Active and paused household expenses."}
          </p>
        </div>
        <button type="button" disabled={addDisabled} onClick={onAdd} className="rounded-lg bg-stone-950 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-950 dark:hover:bg-white">
          Add {investment ? "investment" : "expense"}
        </button>
      </div>
      {error && editingId ? (
        <p role="alert" className="px-4 pt-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className={`w-full ${investment ? "min-w-[1250px]" : "min-w-[1320px]"} border-collapse text-sm`}>
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900 dark:text-stone-400">
            <tr>
              <th className="px-3 py-2">Expense</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Monthly</th>
              <th className="px-3 py-2 text-right">Annual</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2 text-center">Retirement?</th>
              <th className="px-3 py-2 text-center">Essential?</th>
              <th className="px-3 py-2">Period</th>
              <th className="px-3 py-2">Notes</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((expense) => {
              const isEditing = editingId === expense.id && draft !== null;
              const row = isEditing ? draft : expense;
              const amounts = calculateExpenseAmounts(row);

              return (
                <tr key={expense.id} className={`border-t border-stone-100 align-middle dark:border-white/10 ${expense.active ? "" : "opacity-55"}`}>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input aria-label="Expense name" className={`${inputClass} w-36`} value={row.name} onChange={(event) => onDraftChange("name", event.currentTarget.value)} />
                    ) : <span className="font-medium text-stone-900 dark:text-stone-100">{expense.name}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input aria-label="Category" className={`${inputClass} w-32`} value={row.category} onChange={(event) => onDraftChange("category", event.currentTarget.value)} />
                    ) : expense.category}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input
                          aria-label="Monthly amount"
                          type="number"
                          min="0"
                          step="100"
                          className={`${inputClass} w-28 text-right`}
                          value={amounts.monthlyAmount}
                          onChange={(event) => {
                            const value = event.currentTarget.valueAsNumber;
                            if (Number.isFinite(value) && value >= 0) onMonthlyChange(value);
                          }}
                        />
                        <select aria-label="Frequency" className={`${inputClass} w-28`} value={row.frequency} onChange={(event) => onFrequencyChange(event.currentTarget.value as ExpenseFrequency)}>
                          {frequencies.map((frequency) => <option key={frequency} value={frequency}>{frequency}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          aria-label={`${expense.name} monthly amount`}
                          type="number"
                          min="0"
                          step="100"
                          className={`${inputClass} w-28 text-right`}
                          value={amounts.monthlyAmount}
                          onChange={(event) => {
                            const value = event.currentTarget.valueAsNumber;
                            if (Number.isFinite(value) && value >= 0) onCurrentMonthlyChange(expense, value);
                          }}
                        />
                        <span className="text-xs text-stone-500">/ mo</span>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{formatMoney(amounts.annualAmount)}</td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <select aria-label="Expense type" className={`${inputClass} w-32`} value={row.expenseType} onChange={(event) => {
                        const expenseType = event.currentTarget.value as ExpenseType;
                        onDraftChange("expenseType", expenseType);
                        if (expenseType === "investment") onDraftChange("retirementIncluded", false);
                      }}>
                        {expenseTypes.map((type) => <option key={type} value={type}>{formatType(type)}</option>)}
                      </select>
                    ) : formatType(expense.expenseType)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input aria-label={`Include ${expense.name} in retirement`} type="checkbox" checked={row.retirementIncluded} disabled={!isEditing || row.expenseType === "investment"} onChange={(event) => onDraftChange("retirementIncluded", event.currentTarget.checked)} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input aria-label={`${isEditing ? row.name : expense.name} is essential`} type="checkbox" checked={row.essential} disabled={!isEditing} onChange={(event) => onDraftChange("essential", event.currentTarget.checked)} />
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input aria-label="Start year" type="number" step="1" className={`${inputClass} w-20`} value={row.startYear} onChange={(event) => {
                          const value = event.currentTarget.valueAsNumber;
                          if (Number.isInteger(value)) onDraftChange("startYear", value);
                        }} />
                        <span>–</span>
                        <input aria-label="End year (optional)" type="number" step="1" className={`${inputClass} w-20`} placeholder="ongoing" value={row.endYear ?? ""} onChange={(event) => {
                          if (event.currentTarget.value === "") {
                            onDraftChange("endYear", undefined);
                            return;
                          }
                          const value = event.currentTarget.valueAsNumber;
                          if (Number.isInteger(value)) onDraftChange("endYear", value);
                        }} />
                      </div>
                    ) : `${expense.startYear} – ${expense.endYear ?? "ongoing"}`}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <input aria-label="Notes" className={`${inputClass} w-36`} value={row.notes} onChange={(event) => onDraftChange("notes", event.currentTarget.value)} />
                    ) : <span className="block max-w-40 truncate" title={expense.notes}>{expense.notes || "—"}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {!isEditing && (
                      <button type="button" aria-pressed={expense.active} onClick={() => onToggleActive(expense)} className="rounded-full border border-stone-300 px-2 py-1 text-xs font-medium dark:border-white/20">
                        {expense.active ? "Active" : "Paused"}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isEditing ? (
                      <div className="flex gap-1">
                        <button type="button" onClick={onSave} className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-100">Save</button>
                        <button type="button" onClick={onCancel} className="rounded-md px-2 py-1 text-xs text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-white/[0.06]">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button type="button" disabled={editingId !== null} onClick={() => onEdit(expense)} className="grid h-7 w-7 place-items-center rounded-md text-sky-700 hover:bg-sky-50 disabled:opacity-50 dark:text-sky-200 dark:hover:bg-sky-400/10" aria-label={`Edit ${expense.name}`} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" disabled={editingId !== null} onClick={() => onDelete(expense.id)} className="grid h-7 w-7 place-items-center rounded-md text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-200 dark:hover:bg-rose-400/10" aria-label={`Delete ${expense.name}`} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !editingId ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-sm text-stone-500">No {investment ? "investments" : "expenses"} yet. Add one to begin.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="border-t border-stone-200 px-4 py-2 text-xs text-stone-500 dark:border-white/10 dark:text-stone-400">
        Monthly is the normalized equivalent; annual totals are calculated from frequency. Annual inflation is editable per expense in Future Projection.
      </p>
    </section>
  );
}

export default function ExpensePlanner() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(() => createDefaultExpenses(currentYear));
  const [section, setSection] = useState<PlannerSection>("current-budget");
  const [income, setIncome] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExpenseItem | null>(null);
  const [isNewExpense, setIsNewExpense] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectionYear, setProjectionYear] = useState(currentYear + 1);
  const [retirementYear, setRetirementYear] = useState(currentYear + 19);
  const [withdrawalRate, setWithdrawalRate] = useState(4);
  const budget = useMemo(() => calculateCurrentBudget(expenses, currentYear), [expenses]);
  const projection = useMemo(
    () => calculateFutureExpenseProjection(expenses, projectionYear, currentYear),
    [expenses, projectionYear],
  );
  const retirement = useMemo(
    () => calculateRetirementExpenses(expenses, retirementYear, currentYear),
    [expenses, retirementYear],
  );
  const retirementCorpus = calculateRequiredRetirementCorpus(
    retirement.retirementEligibleExpense.annualAmount,
    withdrawalRate,
  );
  const monthlySurplus = calculateMonthlySurplus(income, budget.totalCurrentExpense.monthlyAmount);

  const addExpense = (expenseType: ExpenseType) => {
    const nextExpense = makeNewExpense(expenseType);
    setExpenses((current) => [nextExpense, ...current]);
    setEditingId(nextExpense.id);
    setDraft(nextExpense);
    setIsNewExpense(true);
    setError(null);
  };

  const editExpense = (expense: ExpenseItem) => {
    setEditingId(expense.id);
    setDraft({ ...expense });
    setIsNewExpense(false);
    setError(null);
  };

  const cancelEdit = () => {
    if (isNewExpense && editingId) {
      setExpenses((current) => current.filter((expense) => expense.id !== editingId));
    }
    setEditingId(null);
    setDraft(null);
    setIsNewExpense(false);
    setError(null);
  };

  const updateDraft = <K extends keyof ExpenseItem>(key: K, value: ExpenseItem[K]) => {
    setDraft((current) => current ? { ...current, [key]: value } : current);
  };

  const changeMonthlyEquivalent = (monthlyEquivalent: number) => {
    setDraft((current) => current
      ? { ...current, monthlyAmount: monthlyEquivalent * 12 / occurrencesPerYear[current.frequency] }
      : current);
  };

  const changeFrequency = (frequency: ExpenseFrequency) => {
    setDraft((current) => {
      if (!current) return current;
      const monthlyEquivalent = calculateExpenseAmounts(current).monthlyAmount;
      return { ...current, frequency, monthlyAmount: monthlyEquivalent * 12 / occurrencesPerYear[frequency] };
    });
  };

  const saveExpense = () => {
    if (!draft || !draft.name.trim() || !draft.category.trim()) {
      setError("Enter an expense name and category.");
      return;
    }
    if (!Number.isFinite(draft.monthlyAmount) || draft.monthlyAmount < 0 ||
      !Number.isFinite(draft.inflationRate) || draft.inflationRate < 0) {
      setError("Amounts and inflation must be valid non-negative numbers.");
      return;
    }
    if (!Number.isInteger(draft.startYear) ||
      (draft.endYear !== undefined && (!Number.isInteger(draft.endYear) || draft.endYear < draft.startYear))) {
      setError("Enter a valid expense period. The end year must not be earlier than the start year.");
      return;
    }
    setExpenses((current) => current.map((expense) => expense.id === draft.id
      ? {
          ...draft,
          name: draft.name.trim(),
          category: draft.category.trim(),
          essential: draft.expenseType === "investment" ? false : draft.essential,
          retirementIncluded: draft.expenseType === "investment" ? false : draft.retirementIncluded,
        }
      : expense));
    setEditingId(null);
    setDraft(null);
    setIsNewExpense(false);
    setError(null);
  };

  const deleteExpense = (expenseId: string) => {
    setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
    if (editingId === expenseId) {
      setEditingId(null);
      setDraft(null);
      setIsNewExpense(false);
    }
  };

  const toggleActive = (expense: ExpenseItem) => {
    setExpenses((current) => current.map((item) => item.id === expense.id ? { ...item, active: !item.active } : item));
  };

  const changeCurrentMonthlyAmount = (expense: ExpenseItem, monthlyEquivalent: number) => {
    setExpenses((current) => current.map((item) => item.id === expense.id
      ? {
          ...item,
          monthlyAmount: monthlyEquivalent * 12 / occurrencesPerYear[item.frequency],
        }
      : item));
  };

  const updateExpenseInflation = (expenseId: string, annualRate: number) => {
    setExpenses((current) => current.map((expense) => expense.id === expenseId
      ? { ...expense, inflationRate: annualRate }
      : expense));
  };

  const sections: { id: PlannerSection; label: string }[] = [
    { id: "current-budget", label: "Current Budget" },
    { id: "future-projection", label: "Future Projection" },
    { id: "retirement", label: "Retirement" },
  ];

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-2" aria-label="Expense Planner sections">
        {sections.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={section === item.id}
            onClick={() => setSection(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              section === item.id
                ? "bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950"
                : "border border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-300 dark:hover:bg-white/[0.08]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {section === "current-budget" ? (
        <div className="space-y-4">
          <section className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-stone-950 dark:text-stone-50">Current Budget</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Track living costs and investments separately.</p>
            </div>
            <label className="grid gap-1 text-xs font-medium text-stone-500 dark:text-stone-400">
              Monthly income (optional)
              <input
                type="number"
                min="0"
                step="100"
                className={`${inputClass} w-48`}
                value={income ?? ""}
                onChange={(event) => {
                  if (event.currentTarget.value === "") {
                    setIncome(null);
                    return;
                  }
                  const value = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(value) && value >= 0) setIncome(value);
                }}
              />
            </label>
          </section>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Monthly living expenses" value={formatMoney(budget.totalCurrentLivingExpense.monthlyAmount)} />
            <MetricCard label="Annual living expenses" value={formatMoney(budget.totalCurrentLivingExpense.annualAmount)} />
            <MetricCard label="Investments" value={formatMoney(budget.totalInvestmentContribution.monthlyAmount)} detail={`${formatMoney(budget.totalInvestmentContribution.annualAmount)} annually`} />
            <MetricCard label="Monthly cash outflow" value={formatMoney(budget.totalCurrentExpense.monthlyAmount)} />
            <MetricCard
              label="Monthly surplus"
              value={monthlySurplus === null ? "—" : formatMoney(monthlySurplus)}
              detail={income === null ? "Add monthly income to calculate" : "Income minus all expenses and investments"}
            />
            <MetricCard label="Essential expenses" value={formatMoney(budget.essentialExpense.monthlyAmount)} />
            <MetricCard label="Discretionary expenses" value={formatMoney(budget.discretionaryExpense.monthlyAmount)} />
            <MetricCard label="Health expenses" value={formatMoney(budget.healthExpense.monthlyAmount)} />
          </div>
          <ExpenseTable
            expenses={expenses}
            editingId={editingId}
            draft={draft}
            error={error}
            onAdd={() => addExpense("discretionary")}
            onEdit={editExpense}
            onCancel={cancelEdit}
            onSave={saveExpense}
            onDelete={deleteExpense}
            onToggleActive={toggleActive}
            onDraftChange={updateDraft}
            onMonthlyChange={changeMonthlyEquivalent}
            onFrequencyChange={changeFrequency}
            onCurrentMonthlyChange={changeCurrentMonthlyAmount}
            addDisabled={editingId !== null}
          />
          <ExpenseTable
            expenses={expenses}
            investment
            editingId={editingId}
            draft={draft}
            error={error}
            onAdd={() => addExpense("investment")}
            onEdit={editExpense}
            onCancel={cancelEdit}
            onSave={saveExpense}
            onDelete={deleteExpense}
            onToggleActive={toggleActive}
            onDraftChange={updateDraft}
            onMonthlyChange={changeMonthlyEquivalent}
            onFrequencyChange={changeFrequency}
            onCurrentMonthlyChange={changeCurrentMonthlyAmount}
            addDisabled={editingId !== null}
          />
        </div>
      ) : null}

      {section === "future-projection" ? (
        <div className="space-y-4">
          <section className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-stone-950 dark:text-stone-50">Future Projection</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Project each active expense using its own annual inflation rate.</p>
            </div>
            <NumberInput label="Projection year" min={currentYear} value={projectionYear} onChange={setProjectionYear} />
          </section>
          <div className="grid gap-2 sm:grid-cols-3">
            <MetricCard label={`${projectionYear} living expenses / month`} value={formatMoney(projection.projectedLivingExpense.monthlyAmount)} />
            <MetricCard label={`${projectionYear} investments / month`} value={formatMoney(projection.projectedInvestmentContribution.monthlyAmount)} />
            <MetricCard label={`${projectionYear} total outflow / year`} value={formatMoney(projection.totalProjectedExpense.annualAmount)} />
          </div>
          <ProjectedExpenseTable
            expenses={projection.expenses}
            onBaseMonthlyChange={(expenseId, monthlyEquivalent) => {
              setExpenses((current) => current.map((expense) => {
                if (expense.id !== expenseId) return expense;
                return {
                  ...expense,
                  projectionBaseAmount: monthlyEquivalent * 12 / occurrencesPerYear[expense.frequency],
                };
              }));
            }}
            onInflationChange={updateExpenseInflation}
          />
        </div>
      ) : null}

      {section === "retirement" ? (
        <div className="space-y-4">
          <section className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-stone-950 dark:text-stone-50">Retirement expenses</h2>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Uses each expense’s annual inflation rate; investments, excluded expenses, and costs ended before retirement are omitted.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <NumberInput label="Retirement year" min={currentYear} value={retirementYear} onChange={setRetirementYear} />
              <NumberInput label="Withdrawal rate" min={0.01} value={withdrawalRate} onChange={setWithdrawalRate} step={0.25} />
            </div>
          </section>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Retirement living expenses / month" value={formatMoney(retirement.retirementEligibleExpense.monthlyAmount)} />
            <MetricCard label="Retirement living expenses / year" value={formatMoney(retirement.retirementEligibleExpense.annualAmount)} />
            <MetricCard label="Estimated retirement corpus" value={formatMoney(retirementCorpus)} detail={`At a ${withdrawalRate}% withdrawal rate`} />
            <MetricCard label="Health / month" value={formatMoney(retirement.healthExpense.monthlyAmount)} />
            <MetricCard label="Essential / month" value={formatMoney(retirement.essentialExpense.monthlyAmount)} />
            <MetricCard label="Discretionary / month" value={formatMoney(retirement.discretionaryExpense.monthlyAmount)} />
            <MetricCard label="Irregular / month" value={formatMoney(retirement.irregularExpense.monthlyAmount)} />
          </div>
          <ProjectedExpenseTable expenses={retirement.expenses} />
        </div>
      ) : null}
    </div>
  );
}

function ProjectedExpenseTable({
  expenses,
  onBaseMonthlyChange,
  onInflationChange,
}: {
  expenses: ReturnType<typeof calculateFutureExpenseProjection>["expenses"];
  onBaseMonthlyChange?: (expenseId: string, monthlyEquivalent: number) => void;
  onInflationChange?: (expenseId: string, annualRate: number) => void;
}) {
  return (
    <section className={`${cardClass} overflow-hidden p-0`}>
      <div className="overflow-x-auto">
        <table className={`w-full ${onInflationChange ? "min-w-[900px]" : "min-w-[720px]"} border-collapse text-sm`}>
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900 dark:text-stone-400">
            <tr>
              <th className="px-3 py-2">Expense</th>
              <th className="px-3 py-2">Category</th>
              {onBaseMonthlyChange ? <th className="px-3 py-2 text-right">Base monthly</th> : null}
              <th className="px-3 py-2 text-right">Projected monthly</th>
              <th className="px-3 py-2 text-right">Projected annual</th>
              <th className="px-3 py-2 text-right">Annual inflation</th>
              <th className="px-3 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id} className="border-t border-stone-100 dark:border-white/10">
                <td className="px-3 py-2 font-medium">{expense.name}</td>
                <td className="px-3 py-2">{expense.category}</td>
                {onBaseMonthlyChange ? (
                  <td className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min="0"
                      step="100"
                      aria-label={`${expense.name} forecast starting monthly amount`}
                      className={`${inputClass} w-32 text-right`}
                      value={calculateExpenseAmounts({
                        ...expense,
                        monthlyAmount: expense.projectionBaseAmount ?? expense.monthlyAmount,
                      }).monthlyAmount}
                      onChange={(event) => {
                        const value = event.currentTarget.valueAsNumber;
                        if (Number.isFinite(value) && value >= 0) onBaseMonthlyChange(expense.id, value);
                      }}
                    />
                  </td>
                ) : null}
                <td className="px-3 py-2 text-right">{formatMoney(expense.projectedMonthlyAmount)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(expense.projectedAnnualAmount)}</td>
                <td className="px-3 py-2 text-right">
                  {onInflationChange ? (
                    <div className="inline-flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        aria-label={`${expense.name} annual inflation rate`}
                        className={`${inputClass} w-20 text-right`}
                        value={expense.appliedInflationRate}
                        onChange={(event) => {
                          const value = event.currentTarget.valueAsNumber;
                          if (Number.isFinite(value) && value >= 0) onInflationChange(expense.id, value);
                        }}
                      />
                      <span>% / yr</span>
                    </div>
                  ) : `${expense.appliedInflationRate}% / yr`}
                </td>
                <td className="px-3 py-2">{formatType(expense.expenseType)}</td>
              </tr>
            ))}
            {expenses.length === 0 ? (
              <tr><td colSpan={6 + Number(Boolean(onBaseMonthlyChange))} className="px-4 py-8 text-center text-sm text-stone-500">No active expenses in this year.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
