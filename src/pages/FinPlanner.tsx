import { useMemo, useState } from "react";

type ProjectionRow = {
  year: number;
  age: number;
  monthlySip: number;
  annualSip: number;
  sipCorpus: number;
  annualLumpsum: number;
  lumpsumCorpus: number;
  totalInvested: number;
  projectedCorpus: number;
  monthlyRequired: number;
  annualRequired: number;
};

type PlannerInputs = {
  startYear: number;
  currentAge: number;
  retirementAge: number;
  monthlySip: number;
  sipStepUpPercent: number;
  existingCorpus: number;
  expectedReturnPercent: number;
  firstYearLumpsum: number;
  annualLumpsum: number;
  lumpsumStartsAfterYears: number;
  currentMonthlyExpense: number;
  inflationPercent: number;
  withdrawalRatePercent: number;
};

const inputClass =
  "h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 focus:border-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10";

const defaultInputs: PlannerInputs = {
  startYear: 2025,
  currentAge: 39,
  retirementAge: 58,
  monthlySip: 5000,
  sipStepUpPercent: 20,
  existingCorpus: 430000,
  expectedReturnPercent: 10,
  firstYearLumpsum: 0,
  annualLumpsum: 100000,
  lumpsumStartsAfterYears: 2,
  currentMonthlyExpense: 40833,
  inflationPercent: 8,
  withdrawalRatePercent: 4,
};

function formatInr(value: number) {
  return `INR ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value))}`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function clampNumber(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function calculateProjection(inputs: PlannerInputs): ProjectionRow[] {
  const years = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const annualReturn = inputs.expectedReturnPercent / 100;
  const inflation = inputs.inflationPercent / 100;
  const sipStepUp = inputs.sipStepUpPercent / 100;
  let sipCorpus = 0;
  let lumpsumCorpus = inputs.existingCorpus;
  let projectedCorpus = inputs.existingCorpus;

  return Array.from({ length: years + 1 }, (_, index) => {
    const monthlySip = inputs.monthlySip * (1 + sipStepUp) ** index;
    const annualSip = monthlySip * 12;
    const annualLumpsum =
      index === 0
        ? inputs.firstYearLumpsum
        : index >= inputs.lumpsumStartsAfterYears
          ? inputs.annualLumpsum
          : 0;
    sipCorpus += annualSip;
    lumpsumCorpus += annualLumpsum;
    projectedCorpus = (projectedCorpus + annualSip + annualLumpsum) * (1 + annualReturn);
    const monthlyRequired = inputs.currentMonthlyExpense * (1 + inflation) ** index;
    const annualRequired = monthlyRequired * 12;

    return {
      year: inputs.startYear + index,
      age: inputs.currentAge + index,
      monthlySip,
      annualSip,
      sipCorpus,
      annualLumpsum,
      lumpsumCorpus,
      totalInvested: inputs.existingCorpus + sipCorpus + (lumpsumCorpus - inputs.existingCorpus),
      projectedCorpus,
      monthlyRequired,
      annualRequired,
    };
  });
}

function calculateMonthlySipForTarget(target: number, existingCorpus: number, years: number, annualReturnPercent: number) {
  const months = Math.max(1, years * 12);
  const monthlyReturn = annualReturnPercent / 100 / 12;
  const futureExistingCorpus = existingCorpus * (1 + annualReturnPercent / 100) ** years;
  const gap = Math.max(0, target - futureExistingCorpus);
  if (gap === 0) return 0;
  if (monthlyReturn === 0) return gap / months;
  return (gap * monthlyReturn) / ((1 + monthlyReturn) ** months - 1);
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          className={`${inputClass} w-full`}
          value={value}
          onChange={(event) => onChange(clampNumber(event.target.valueAsNumber, 0))}
        />
        {suffix ? <span className="text-sm font-medium text-stone-500 dark:text-stone-400">{suffix}</span> : null}
      </div>
    </label>
  );
}

function SummaryCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "good" | "bad" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "bad"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200"
        : "border-stone-200 bg-white text-stone-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-50";

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <p className="text-xs font-medium uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}

export default function FinPlanner() {
  const [inputs, setInputs] = useState<PlannerInputs>(defaultInputs);

  const rows = useMemo(() => calculateProjection(inputs), [inputs]);
  const finalRow = rows.at(-1);
  const yearsToRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const targetCorpus = finalRow
    ? finalRow.annualRequired / Math.max(inputs.withdrawalRatePercent / 100, 0.001)
    : 0;
  const projectedCorpus = finalRow?.projectedCorpus ?? 0;
  const surplus = projectedCorpus - targetCorpus;
  const requiredMonthlySip = calculateMonthlySipForTarget(
    targetCorpus,
    inputs.existingCorpus,
    yearsToRetirement,
    inputs.expectedReturnPercent
  );

  const updateInput = (key: keyof PlannerInputs, value: number) => {
    setInputs((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">FinPlanner</p>
            <h2 className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-50">Retirement SIP Planner</h2>
            <p className="mt-2 max-w-3xl text-sm text-stone-600 dark:text-stone-300">
              Plan yearly SIP step-ups, lumpsum additions, and retirement expense needs in one projection.
            </p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-300">
            <span className="font-semibold text-stone-950 dark:text-stone-50">{yearsToRetirement}</span> years to retirement
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <aside className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-base font-semibold text-stone-950 dark:text-stone-50">Inputs</h3>
          <div className="mt-4 grid gap-4">
            <Field label="Start year" value={inputs.startYear} onChange={(value) => updateInput("startYear", value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age now" value={inputs.currentAge} onChange={(value) => updateInput("currentAge", value)} />
              <Field label="Retire at" value={inputs.retirementAge} onChange={(value) => updateInput("retirementAge", value)} />
            </div>
            <Field label="Monthly SIP" value={inputs.monthlySip} onChange={(value) => updateInput("monthlySip", value)} />
            <Field label="SIP step-up" value={inputs.sipStepUpPercent} onChange={(value) => updateInput("sipStepUpPercent", value)} suffix="%" />
            <Field label="Existing corpus" value={inputs.existingCorpus} onChange={(value) => updateInput("existingCorpus", value)} />
            <Field label="Expected return" value={inputs.expectedReturnPercent} onChange={(value) => updateInput("expectedReturnPercent", value)} suffix="%" />
            <Field label="First-year lumpsum" value={inputs.firstYearLumpsum} onChange={(value) => updateInput("firstYearLumpsum", value)} />
            <Field label="Annual lumpsum" value={inputs.annualLumpsum} onChange={(value) => updateInput("annualLumpsum", value)} />
            <Field label="Lumpsum after years" value={inputs.lumpsumStartsAfterYears} onChange={(value) => updateInput("lumpsumStartsAfterYears", value)} />
            <Field label="Monthly expense" value={inputs.currentMonthlyExpense} onChange={(value) => updateInput("currentMonthlyExpense", value)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Inflation" value={inputs.inflationPercent} onChange={(value) => updateInput("inflationPercent", value)} suffix="%" />
              <Field label="Withdrawal" value={inputs.withdrawalRatePercent} onChange={(value) => updateInput("withdrawalRatePercent", value)} suffix="%" />
            </div>
          </div>
        </aside>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard label="Corpus at retirement" value={formatInr(projectedCorpus)} />
            <SummaryCard label="Target corpus" value={formatInr(targetCorpus)} />
            <SummaryCard label={surplus >= 0 ? "Projected surplus" : "Projected shortfall"} value={formatInr(Math.abs(surplus))} tone={surplus >= 0 ? "good" : "bad"} />
            <SummaryCard label="Monthly expense then" value={formatInr(finalRow?.monthlyRequired ?? 0)} />
            <SummaryCard label="Required SIP estimate" value={formatInr(requiredMonthlySip)} />
            <SummaryCard label="Total invested" value={formatInr(finalRow?.totalInvested ?? 0)} />
          </div>

          <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="border-b border-stone-200 bg-stone-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <h3 className="text-base font-semibold text-stone-950 dark:text-stone-50">Yearly projection</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[1080px] w-full border-collapse text-sm">
                <thead className="bg-stone-100 text-left text-xs uppercase tracking-[0.14em] text-stone-500 dark:bg-white/[0.03] dark:text-stone-400">
                  <tr>
                    <th className="px-3 py-3">Year</th>
                    <th className="px-3 py-3">Age</th>
                    <th className="px-3 py-3 text-right">Monthly SIP</th>
                    <th className="px-3 py-3 text-right">Annual SIP</th>
                    <th className="px-3 py-3 text-right">SIP corpus</th>
                    <th className="px-3 py-3 text-right">Annual lumpsum</th>
                    <th className="px-3 py-3 text-right">Lumpsum corpus</th>
                    <th className="px-3 py-3 text-right">Total invested</th>
                    <th className="px-3 py-3 text-right">{inputs.expectedReturnPercent}% corpus</th>
                    <th className="px-3 py-3 text-right">Monthly req</th>
                    <th className="px-3 py-3 text-right">Annual req</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const isMilestone = row.age === inputs.retirementAge || index === 0 || index % 5 === 0;
                    return (
                      <tr
                        key={row.year}
                        className={`border-t border-stone-100 dark:border-white/10 ${
                          isMilestone ? "bg-emerald-50/70 font-semibold dark:bg-emerald-950/20" : ""
                        }`}
                      >
                        <td className="px-3 py-2">{row.year}</td>
                        <td className="px-3 py-2">{row.age}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.monthlySip)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.annualSip)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.sipCorpus)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.annualLumpsum)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.lumpsumCorpus)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.totalInvested)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.projectedCorpus)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.monthlyRequired)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.annualRequired)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
