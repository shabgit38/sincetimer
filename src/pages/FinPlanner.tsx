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
  monthlyExpense: number;
  annualExpense: number;
};

type PlannerInputs = {
  startYear: number;
  currentAge: number;
  retirementAge: number;
  monthlySip: number;
  sipStepUpPercent: number;
  existingCorpus: number;
  expectedReturnPercent: number;
  annualLumpsum: number;
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
  existingCorpus: 450000,
  expectedReturnPercent: 10,
  annualLumpsum: 0,
  currentMonthlyExpense: 50000,
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

function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex normal-case tracking-normal">
      <button
        type="button"
        className="grid h-4 w-4 place-items-center rounded-full border border-stone-300 text-[10px] font-bold text-stone-500 outline-none transition hover:border-stone-500 hover:text-stone-800 focus:border-stone-500 focus:ring-2 focus:ring-stone-300 dark:border-white/25 dark:text-stone-400 dark:hover:border-white/50 dark:hover:text-stone-100 dark:focus:ring-white/20"
        aria-label={text}
      >
        ?
      </button>
      <span role="tooltip" className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 hidden w-56 -translate-x-1/2 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white opacity-100 shadow-2xl group-hover:block group-focus-within:block dark:border-stone-300 dark:bg-stone-100 dark:text-stone-950">
        {text}
      </span>
    </span>
  );
}

function HeaderCell({ label, help, right = false, className = "" }: { label: string; help: string; right?: boolean; className?: string }) {
  return (
    <th className={`px-3 py-3 ${right ? "text-right" : "text-left"} ${className}`}>
      <span className={`inline-flex items-center gap-1.5 ${right ? "justify-end" : "justify-start"}`}>
        {label}
        <InfoTip text={help} />
      </span>
    </th>
  );
}

function calculateProjection(inputs: PlannerInputs, lumpsumOverrides: Record<number, number>): ProjectionRow[] {
  const years = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const annualReturn = inputs.expectedReturnPercent / 100;
  const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const inflation = inputs.inflationPercent / 100;
  const sipStepUp = inputs.sipStepUpPercent / 100;
  let sipCorpus = 0;
  let lumpsumCorpus = inputs.existingCorpus;
  let projectedCorpus = inputs.existingCorpus;

  return Array.from({ length: years }, (_, index) => {
    const year = inputs.startYear + index;
    const monthlySip = inputs.monthlySip * (1 + sipStepUp) ** index;
    const annualSip = monthlySip * 12;
    const defaultAnnualLumpsum = inputs.annualLumpsum;
    const annualLumpsum = Object.prototype.hasOwnProperty.call(lumpsumOverrides, year)
      ? lumpsumOverrides[year]
      : defaultAnnualLumpsum;
    const corpusGrowthFactor = (1 + monthlyReturn) ** 12;
    const sipFutureValue = monthlyReturn === 0
      ? annualSip
      : monthlySip * (((1 + monthlyReturn) ** 12 - 1) / monthlyReturn) * (1 + monthlyReturn);
    projectedCorpus = projectedCorpus * corpusGrowthFactor + sipFutureValue + annualLumpsum;
    sipCorpus += annualSip;
    lumpsumCorpus += annualLumpsum;
    const monthlyExpense = inputs.currentMonthlyExpense * (1 + inflation) ** index;
    const annualExpense = monthlyExpense * 12;

    return {
      year,
      age: inputs.currentAge + index,
      monthlySip,
      annualSip,
      sipCorpus,
      annualLumpsum,
      lumpsumCorpus,
      totalInvested: inputs.existingCorpus + sipCorpus + (lumpsumCorpus - inputs.existingCorpus),
      projectedCorpus,
      monthlyExpense,
      annualExpense,
    };
  });
}

function calculateMonthlySipForTarget(target: number, existingCorpus: number, years: number, annualReturnPercent: number) {
  const months = Math.max(1, years * 12);
  const annualReturn = annualReturnPercent / 100;
  const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const futureExistingCorpus = existingCorpus * (1 + monthlyReturn) ** months;
  const gap = Math.max(0, target - futureExistingCorpus);
  if (gap === 0) return 0;
  if (monthlyReturn === 0) return gap / months;
  return (gap * monthlyReturn) / (((1 + monthlyReturn) ** months - 1) * (1 + monthlyReturn));
}

function calculateStartingSipForTarget(
  target: number,
  existingCorpus: number,
  years: number,
  annualReturnPercent: number,
  annualStepUpPercent: number
) {
  if (years <= 0) return 0;

  const annualReturn = annualReturnPercent / 100;
  const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const annualStepUp = annualStepUpPercent / 100;
  const months = years * 12;
  const corpusGrowthFactor = (1 + monthlyReturn) ** 12;
  const futureExistingCorpus = existingCorpus * (1 + monthlyReturn) ** months;
  const gap = Math.max(0, target - futureExistingCorpus);
  if (gap === 0) return 0;

  const oneYearSipFactor = monthlyReturn === 0
    ? 12
    : (((1 + monthlyReturn) ** 12 - 1) / monthlyReturn) * (1 + monthlyReturn);
  const startingSipFutureValueFactor = Array.from({ length: years }, (_, index) =>
    (1 + annualStepUp) ** index * oneYearSipFactor * corpusGrowthFactor ** (years - index - 1)
  ).reduce((total, factor) => total + factor, 0);

  return startingSipFutureValueFactor > 0 ? gap / startingSipFutureValueFactor : 0;
}

function Field({
  label,
  help,
  value,
  onChange,
  suffix,
}: {
  label: string;
  help: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-stone-500 dark:text-stone-400">{label}<InfoTip text={help} /></span>
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

function SummaryCard({ label, help, value, detail, tone = "neutral" }: { label: string; help: string; value: string; detail?: string; tone?: "neutral" | "good" | "bad" }) {
  const toneClass =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:text-emerald-200"
      : tone === "bad"
        ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200"
        : "border-stone-200 bg-white text-stone-950 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-50";

  return (
    <article className={`rounded-xl border p-4 shadow-sm ${toneClass}`}>
      <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em]">
        <span className="opacity-70">{label}</span>
        <InfoTip text={help} />
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {detail ? <p className="mt-2 text-xs opacity-70">{detail}</p> : null}
    </article>
  );
}

export default function FinPlanner() {
  const [inputs, setInputs] = useState<PlannerInputs>(defaultInputs);
  const [lumpsumOverrides, setLumpsumOverrides] = useState<Record<number, number>>({});

  const rows = useMemo(() => calculateProjection(inputs, lumpsumOverrides), [inputs, lumpsumOverrides]);
  const finalRow = rows.at(-1);
  const yearsToRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const monthlyExpenseAtRetirement = inputs.currentMonthlyExpense * (1 + inputs.inflationPercent / 100) ** yearsToRetirement;
  const annualExpenseAtRetirement = monthlyExpenseAtRetirement * 12;
  const targetCorpus = annualExpenseAtRetirement / Math.max(inputs.withdrawalRatePercent / 100, 0.001);
  const projectedCorpus = finalRow?.projectedCorpus ?? inputs.existingCorpus;
  const surplus = projectedCorpus - targetCorpus;
  const requiredMonthlySip = calculateMonthlySipForTarget(
    targetCorpus,
    inputs.existingCorpus,
    yearsToRetirement,
    inputs.expectedReturnPercent
  );
  const requiredStartingSip = calculateStartingSipForTarget(
    targetCorpus,
    inputs.existingCorpus,
    yearsToRetirement,
    inputs.expectedReturnPercent,
    inputs.sipStepUpPercent
  );
  const startingSipGap = Math.max(0, requiredStartingSip - inputs.monthlySip);

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

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-[360px_1fr]">
          <aside className="min-w-0 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm sm:p-5 lg:row-span-2 dark:border-white/10 dark:bg-white/[0.04]">
          <h3 className="text-base font-semibold text-stone-950 dark:text-stone-50">Inputs</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Start year" help="The first calendar year shown in the projection." value={inputs.startYear} onChange={(value) => updateInput("startYear", value)} />
            <Field label="Retire at" help="The target retirement age and final projection year." value={inputs.retirementAge} onChange={(value) => updateInput("retirementAge", value)} />
            <Field label="Monthly SIP" help="The monthly systematic investment in the first year." value={inputs.monthlySip} onChange={(value) => updateInput("monthlySip", value)} />
            <Field label="SIP step-up" help="The percentage by which Monthly SIP increases each year." value={inputs.sipStepUpPercent} onChange={(value) => updateInput("sipStepUpPercent", value)} suffix="%" />
            <Field label="Existing corpus" help="Your invested balance at the start; it compounds with future contributions." value={inputs.existingCorpus} onChange={(value) => updateInput("existingCorpus", value)} />
            <Field label="Expected return" help="Effective annual return (CAGR). The equivalent monthly rate is (1 + annual return)^(1/12) − 1, so monthly compounding matches the entered annual return." value={inputs.expectedReturnPercent} onChange={(value) => updateInput("expectedReturnPercent", value)} suffix="%" />
            <Field label="Annual lumpsum" help="The default extra yearly investment; each table row can override it." value={inputs.annualLumpsum} onChange={(value) => updateInput("annualLumpsum", value)} />
            <Field label="Monthly expense" help="Your current monthly living expense before inflation." value={inputs.currentMonthlyExpense} onChange={(value) => updateInput("currentMonthlyExpense", value)} />
            <Field label="Inflation" help="The annual rate used to increase projected retirement expenses." value={inputs.inflationPercent} onChange={(value) => updateInput("inflationPercent", value)} suffix="%" />
            <Field label="Withdrawal" help="The annual withdrawal rate used to estimate the target retirement corpus." value={inputs.withdrawalRatePercent} onChange={(value) => updateInput("withdrawalRatePercent", value)} suffix="%" />
          </div>
          </aside>

          <div className="grid min-w-0 content-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            <SummaryCard label="Total invested" help="Existing Corpus plus all SIP principal and year-end lumpsum contributions through retirement." value={formatInr(finalRow?.totalInvested ?? inputs.existingCorpus)} />
            <SummaryCard label="Monthly expense then" help="Formula: Current monthly expense × (1 + Inflation ÷ 100) ^ (Retirement age − Current age)." value={formatInr(monthlyExpenseAtRetirement)} />
            <SummaryCard label="Target corpus" help="Annual inflation-adjusted retirement expense divided by the withdrawal rate." value={formatInr(targetCorpus)} />
            <SummaryCard label="Corpus at retirement" help="Projected end value after all completed SIP periods, monthly compounding, and year-end lumpsums." value={formatInr(projectedCorpus)} />
            <SummaryCard
              label={`Required starting SIP at ${inputs.sipStepUpPercent}% step-up`}
              help="Starting monthly SIP needed to reach the target when it increases by the selected SIP step-up each year. Uses beginning-of-month SIPs and the Existing Corpus; excludes annual lumpsums."
              value={formatInr(requiredStartingSip)}
              detail={`Current: ${formatInr(inputs.monthlySip)} · Gap today: ${formatInr(startingSipGap)}/month`}
            />
            <SummaryCard label={surplus >= 0 ? "Projected surplus" : "Projected shortfall"} help="Difference between the projected retirement corpus and target corpus." value={formatInr(Math.abs(surplus))} tone={surplus >= 0 ? "good" : "bad"} />
            <SummaryCard label="Required fixed SIP" help="Monthly SIP needed if it never increases. Uses beginning-of-month SIPs and the Existing Corpus; excludes annual step-ups and lumpsums." value={formatInr(requiredMonthlySip)} />
          </div>

        <section className="col-span-2 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm lg:col-span-1 lg:col-start-2 dark:border-white/10 dark:bg-white/[0.04]">
            <div className="border-b border-stone-200 bg-stone-50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
              <h3 className="text-base font-semibold text-stone-950 dark:text-stone-50">Yearly projection</h3>
            </div>
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-[1320px] w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-stone-100 text-left text-xs uppercase tracking-[0.14em] text-stone-500 shadow-sm dark:bg-stone-900 dark:text-stone-400">
                  <tr>
                    <HeaderCell label="Year" help="Calendar year for this projection row." />
                    <HeaderCell label="Age" help="Your age at the beginning of this completed age-to-age investment period." />
                    <HeaderCell label="Monthly SIP" help="Monthly SIP after applying yearly step-ups." right />
                    <HeaderCell label="Annual SIP" help="Monthly SIP multiplied by 12." right />
                    <HeaderCell label="SIP corpus" help="Cumulative completed SIP contributions through this investment period, without growth." right />
                    <HeaderCell label="Annual lumpsum" help="Editable extra investment for this year." right />
                    <HeaderCell label="Lumpsum corpus" help="One-time opening Existing Corpus plus cumulative completed year-end lumpsums, without growth." right />
                    <HeaderCell label="Total invested" help="Existing corpus plus all SIP and lumpsum contributions to date." className="!text-[#87d1ff]" right />
                    <HeaderCell label={`${inputs.expectedReturnPercent}% corpus`} help="End-of-period corpus: opening balance compounds monthly, SIPs follow Zerodha beginning-of-month timing, and this row's lumpsum is added at year-end." right />
                    <HeaderCell label="Monthly expense" help="Current monthly expense increased by inflation for this year." right />
                    <HeaderCell label="Annual expense" help="Inflation-adjusted monthly expense multiplied by 12; used to estimate target corpus." right />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const isMilestone = row.age === inputs.retirementAge || index === 0 || index % 5 === 0;
                    const isCurrentYear = row.year === new Date().getFullYear();
                    return (
                      <tr
                        key={row.year}
                        className={`border-t border-stone-100 dark:border-white/10 ${
                          isCurrentYear
                            ? "font-semibold text-amber-600 dark:text-amber-300"
                            : isMilestone
                              ? "bg-emerald-50/70 font-semibold dark:bg-emerald-950/20"
                              : ""
                        }`}
                      >
                        <td className="px-3 py-2">{row.year}</td>
                        <td className="px-3 py-2">{row.age}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.monthlySip)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.annualSip)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.sipCorpus)}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            className="h-8 w-28 rounded-md border border-stone-300 bg-white px-2 text-right text-sm font-medium text-stone-700 outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200 dark:border-white/20 dark:bg-stone-900 dark:text-stone-100 dark:focus:border-stone-300 dark:focus:ring-white/10"
                            value={row.annualLumpsum}
                            onChange={(event) => {
                              const value = clampNumber(event.target.valueAsNumber, 0);
                              setLumpsumOverrides((current) => ({ ...current, [row.year]: Math.max(0, value) }));
                            }}
                            aria-label={`Annual lumpsum for ${row.year}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.lumpsumCorpus)}</td>
                        <td className="px-3 py-2 text-right font-semibold text-[#87d1ff]">{formatNumber(row.totalInvested)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.projectedCorpus)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.monthlyExpense)}</td>
                        <td className="px-3 py-2 text-right">{formatNumber(row.annualExpense)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        </section>
      </section>
    </div>
  );
}
