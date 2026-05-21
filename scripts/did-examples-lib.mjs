import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_EXAMPLES_DIR = "/Users/xianyangzhang/My Drive/DID Examples";

export const EXAMPLE_DATASET_ORDER = [
  "medicaid-insurance",
  "medicaid-mortality",
  "teacher-bargaining",
  "divorce-laws",
  "sentencing-laws",
  "bank-deregulation",
];

export const EXAMPLE_TITLES = {
  "medicaid-insurance": "Medicaid Insurance Coverage",
  "medicaid-mortality": "Medicaid Mortality",
  "teacher-bargaining": "Teacher Collective Bargaining",
  "divorce-laws": "Unilateral Divorce Laws",
  "sentencing-laws": "Sentencing Enhancements",
  "bank-deregulation": "Bank Deregulation",
};

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).filter((r) => r.some((v) => v !== "")).map((r) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) obj[header[i]] = r[i] ?? "";
    return obj;
  });
}

export function readCsv(path) {
  return parseCsv(readFileSync(path, "utf8"));
}

export function csvEscape(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

export function writeCsv(path, rows, columns) {
  const lines = [columns.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => csvEscape(row[col])).join(","));
  }
  writeFileSync(path, `${lines.join("\n")}\n`);
}

export function num(value) {
  if (value === null || value === undefined) return NaN;
  const s = String(value).trim();
  if (s === "" || s.toUpperCase() === "NA" || s === ".") return NaN;
  return Number(s);
}

export function fmt(value, digits = 4) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "NA";
}

export function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

export function addMappedId(rows, sourceCol, targetCol) {
  const values = uniqueSorted(rows.map((r) => r[sourceCol]));
  const ids = new Map(values.map((v, i) => [v, String(i + 1)]));
  for (const row of rows) row[targetCol] = ids.get(row[sourceCol]);
}

export function countBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

export function weightedMean(rows, valueCol, weightCol) {
  let numerator = 0;
  let denominator = 0;
  for (const row of rows) {
    const value = num(row[valueCol]);
    const weight = num(row[weightCol]);
    if (Number.isFinite(value) && Number.isFinite(weight) && weight > 0) {
      numerator += value * weight;
      denominator += weight;
    }
  }
  return denominator > 0 ? numerator / denominator : NaN;
}

function assertSource(path) {
  if (!existsSync(path)) throw new Error(`missing source CSV: ${path}`);
}

function prepareMedicaidInsurance(examplesDir, tmpDir) {
  const source = join(examplesDir, "medicaid-insurance", "ehec_data.csv");
  assertSource(source);
  const rows = readCsv(source);
  addMappedId(rows, "stfips", "state_id");
  for (const row of rows) {
    const g = num(row.yexp2);
    const year = num(row.year);
    row.yexp2_clean = Number.isFinite(g) ? String(g) : "";
    row.treat_post = Number.isFinite(g) && year >= g ? "1" : "0";
    row.dr_treated_2014 = g === 2014 ? "1" : "0";
  }
  const path = join(tmpDir, "medicaid-insurance.csv");
  writeCsv(path, rows, [
    "state_id",
    "stfips",
    "year",
    "dins",
    "yexp2_clean",
    "treat_post",
    "dr_treated_2014",
    "W",
  ]);
  return {
    name: "medicaid-insurance",
    title: EXAMPLE_TITLES["medicaid-insurance"],
    source,
    path,
    loadArgs: {
      path,
      id_var: "state_id",
      time_var: "year",
      treat_timing_var: "yexp2_clean",
      treat_var: "treat_post",
      outcome_var: "dins",
    },
    drdid: {
      outcome_var: "dins",
      treated_var: "dr_treated_2014",
      time_values: [2013, 2014],
      weights_var: "W",
    },
    skill: {
      csv: path,
      id_var: "state_id",
      time_var: "year",
      gname_var: "yexp2_clean",
      treat_post_var: "treat_post",
      outcome_var: "dins",
      control_group: "notyettreated",
      weights_var: "W",
      has_never_treated: true,
    },
  };
}

function prepareMedicaidMortality(examplesDir, tmpDir) {
  const source = join(examplesDir, "medicaid-mortality", "county_mortality_data.csv");
  assertSource(source);
  const excluded = new Set(["10", "11", "25", "36", "50"]);
  const countyRows = readCsv(source).filter((row) =>
    !excluded.has(String(num(row.stfips))) &&
    Number.isFinite(num(row.crude_rate_20_64)));
  const groups = new Map();
  for (const row of countyRows) {
    const key = `${row.stfips}::${row.year}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const rows = [];
  for (const groupRows of groups.values()) {
    const first = groupRows[0];
    const year = num(first.year);
    const yaca = num(first.yaca);
    const cohort = [2014, 2015, 2016, 2019].includes(yaca) ? yaca : NaN;
    const pop = groupRows.reduce((sum, row) => {
      const value = num(row.population_20_64);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    rows.push({
      state_id: String(first.stfips),
      state: first.state,
      year: String(year),
      mortality_rate: String(weightedMean(groupRows, "crude_rate_20_64", "population_20_64")),
      first_treat: Number.isFinite(cohort) ? String(cohort) : "",
      treat_post: Number.isFinite(cohort) && year >= cohort ? "1" : "0",
      dr_treated_2014: cohort === 2014 ? "1" : "0",
      pop_weight: String(pop),
    });
  }
  rows.sort((a, b) => Number(a.state_id) - Number(b.state_id) || Number(a.year) - Number(b.year));
  const path = join(tmpDir, "medicaid-mortality.csv");
  writeCsv(path, rows, [
    "state_id",
    "state",
    "year",
    "mortality_rate",
    "first_treat",
    "treat_post",
    "dr_treated_2014",
    "pop_weight",
  ]);
  return {
    name: "medicaid-mortality",
    title: EXAMPLE_TITLES["medicaid-mortality"],
    source,
    path,
    loadArgs: {
      path,
      id_var: "state_id",
      time_var: "year",
      treat_timing_var: "first_treat",
      treat_var: "treat_post",
      outcome_var: "mortality_rate",
    },
    drdid: {
      outcome_var: "mortality_rate",
      treated_var: "dr_treated_2014",
      time_values: [2013, 2014],
      weights_var: "pop_weight",
    },
    skill: {
      csv: path,
      id_var: "state_id",
      time_var: "year",
      gname_var: "first_treat",
      treat_post_var: "treat_post",
      outcome_var: "mortality_rate",
      control_group: "notyettreated",
      weights_var: "pop_weight",
      has_never_treated: true,
    },
  };
}

function prepareTeacherBargaining(examplesDir, tmpDir) {
  const source = join(examplesDir, "teacher-bargaining", "paglayan_dataset.csv");
  assertSource(source);
  const rows = readCsv(source).filter((row) => {
    const year = num(row.year);
    return year >= 1959 && year <= 1990 && Number.isFinite(num(row.lnppexpend));
  });
  addMappedId(rows, "State", "state_id");
  const gCounts = countBy(rows, (row) => String(num(row.YearCBrequired)));
  let bestG = NaN;
  let bestCount = -1;
  for (const [key, count] of gCounts.entries()) {
    const cohort = Number(key);
    if (Number.isFinite(cohort) && cohort >= 1960 && cohort <= 1980 && count > bestCount) {
      bestG = cohort;
      bestCount = count;
    }
  }
  for (const row of rows) {
    const g = num(row.YearCBrequired);
    const year = num(row.year);
    row.g_clean = Number.isFinite(g) ? String(g) : "";
    row.treat_post = Number.isFinite(g) && year >= g ? "1" : "0";
    row.dr_treated = Number.isFinite(g) && g === bestG ? "1" : "0";
  }
  const path = join(tmpDir, "teacher-bargaining.csv");
  writeCsv(path, rows, [
    "state_id",
    "State",
    "year",
    "lnppexpend",
    "g_clean",
    "treat_post",
    "dr_treated",
  ]);
  const drPre = Number.isFinite(bestG) ? bestG - 1 : 1964;
  const drPost = Number.isFinite(bestG) ? bestG : 1965;
  return {
    name: "teacher-bargaining",
    title: EXAMPLE_TITLES["teacher-bargaining"],
    source,
    path,
    loadArgs: {
      path,
      id_var: "state_id",
      time_var: "year",
      treat_timing_var: "g_clean",
      treat_var: "treat_post",
      outcome_var: "lnppexpend",
    },
    drdid: {
      outcome_var: "lnppexpend",
      treated_var: "dr_treated",
      time_values: [drPre, drPost],
    },
    skill: {
      csv: path,
      id_var: "state_id",
      time_var: "year",
      gname_var: "g_clean",
      treat_post_var: "treat_post",
      outcome_var: "lnppexpend",
      control_group: "nevertreated",
      weights_var: "",
      has_never_treated: true,
    },
  };
}

function prepareDivorceLaws(examplesDir, tmpDir) {
  const source = join(examplesDir, "divorce-laws", "divorce_data.csv");
  assertSource(source);
  const raw = readCsv(source).filter((row) => {
    const year = num(row.year);
    return !["AK", "OK"].includes(row.st) &&
      year >= 1968 &&
      year <= 1985 &&
      Number.isFinite(num(row.div_rate));
  });
  const nYears = uniqueSorted(raw.map((row) => row.year)).length;
  const countsByState = countBy(raw, (row) => row.st);
  const completeStates = new Set([...countsByState.entries()]
    .filter(([, count]) => count === nYears)
    .map(([state]) => state));
  const rows = raw.filter((row) => completeStates.has(row.st));
  addMappedId(rows, "st", "state_id");
  const gCounts = countBy(rows, (row) => String(num(row.lfdivlaw)));
  let bestG = NaN;
  let bestCount = -1;
  for (const [key, count] of gCounts.entries()) {
    const cohort = Number(key);
    if (Number.isFinite(cohort) && cohort >= 1969 && cohort <= 1977 && count > bestCount) {
      bestG = cohort;
      bestCount = count;
    }
  }
  for (const row of rows) {
    const g = num(row.lfdivlaw);
    const year = num(row.year);
    row.g_clean = g === 2000 ? "" : String(g);
    row.treat_post = g !== 2000 && year >= g ? "1" : "0";
    row.dr_treated = Number.isFinite(g) && g === bestG ? "1" : "0";
  }
  const path = join(tmpDir, "divorce-laws.csv");
  writeCsv(path, rows, [
    "state_id",
    "st",
    "year",
    "div_rate",
    "g_clean",
    "treat_post",
    "dr_treated",
    "stpop",
  ]);
  const drPre = Number.isFinite(bestG) ? bestG - 1 : 1968;
  const drPost = Number.isFinite(bestG) ? bestG : 1969;
  return {
    name: "divorce-laws",
    title: EXAMPLE_TITLES["divorce-laws"],
    source,
    path,
    loadArgs: {
      path,
      id_var: "state_id",
      time_var: "year",
      treat_timing_var: "g_clean",
      treat_var: "treat_post",
      outcome_var: "div_rate",
    },
    drdid: {
      outcome_var: "div_rate",
      treated_var: "dr_treated",
      time_values: [drPre, drPost],
      weights_var: "stpop",
    },
    skill: {
      csv: path,
      id_var: "state_id",
      time_var: "year",
      gname_var: "g_clean",
      treat_post_var: "treat_post",
      outcome_var: "div_rate",
      control_group: "notyettreated",
      weights_var: "stpop",
      has_never_treated: true,
    },
  };
}

function prepareSentencingLaws(examplesDir, tmpDir) {
  const source = join(examplesDir, "sentencing-laws", "sentencing_data.csv");
  assertSource(source);
  const complete = readCsv(source).filter((row) => Number.isFinite(num(row.lnpcrrobgun)));
  const allYears = uniqueSorted(complete.map((row) => row.year));
  const countsByState = countBy(complete, (row) => row.state_fips);
  const fullStates = new Set([...countsByState.entries()]
    .filter(([, count]) => count === allYears.length)
    .map(([state]) => state));
  const rows = complete.filter((row) => fullStates.has(row.state_fips));
  const gCounts = countBy(rows, (row) => String(num(row.treatment_year)));
  let bestG = NaN;
  let bestCount = -1;
  for (const [key, count] of gCounts.entries()) {
    const cohort = Number(key);
    if (Number.isFinite(cohort) && cohort > 1970 && count > bestCount) {
      bestG = cohort;
      bestCount = count;
    }
  }
  for (const row of rows) {
    const adoption = num(row.treatment_year);
    const year = num(row.year);
    const g = adoption > 0 ? adoption + 1 : NaN;
    row.g_clean = Number.isFinite(g) ? String(g) : "";
    row.treat_absorbing = Number.isFinite(g) && year >= g ? "1" : "0";
    row.dr_treated = Number.isFinite(adoption) && adoption === bestG ? "1" : "0";
  }
  const path = join(tmpDir, "sentencing-laws.csv");
  writeCsv(path, rows, [
    "state_fips",
    "state_name",
    "year",
    "lnpcrrobgun",
    "g_clean",
    "treat_absorbing",
    "dr_treated",
  ]);
  const drPre = Number.isFinite(bestG) ? bestG : 1975;
  const drPost = Number.isFinite(bestG) ? bestG + 1 : 1976;
  return {
    name: "sentencing-laws",
    title: EXAMPLE_TITLES["sentencing-laws"],
    source,
    path,
    loadArgs: {
      path,
      id_var: "state_fips",
      time_var: "year",
      treat_timing_var: "g_clean",
      treat_var: "treat_absorbing",
      outcome_var: "lnpcrrobgun",
    },
    drdid: {
      outcome_var: "lnpcrrobgun",
      treated_var: "dr_treated",
      time_values: [drPre, drPost],
    },
    skill: {
      csv: path,
      id_var: "state_fips",
      time_var: "year",
      gname_var: "g_clean",
      treat_post_var: "treat_absorbing",
      outcome_var: "lnpcrrobgun",
      control_group: "nevertreated",
      weights_var: "",
      has_never_treated: true,
    },
  };
}

function prepareBankDeregulation(examplesDir, tmpDir) {
  const source = join(examplesDir, "bank-deregulation", "bank_deregulation_data.csv");
  assertSource(source);
  const raw = readCsv(source);
  const rows = raw.filter((row) => {
    const year = num(row.wrkyr);
    const g = num(row.branch_reform);
    const gini = num(row.gini);
    return year <= 1998 && g > 1976 && Number.isFinite(gini) && gini > 0;
  });
  const gCounts = countBy(rows, (row) => String(num(row.branch_reform)));
  let bestG = NaN;
  let bestCount = -1;
  for (const [key, count] of gCounts.entries()) {
    const cohort = Number(key);
    if (Number.isFinite(cohort) && cohort > 1976 && cohort <= 1998 && count > bestCount) {
      bestG = cohort;
      bestCount = count;
    }
  }
  for (const row of rows) {
    const g = num(row.branch_reform);
    const year = num(row.wrkyr);
    row.branch_g = g > 1998 ? "0" : String(g);
    row.treat_intra = g <= 1998 && year >= g ? "1" : "0";
    row.log_gini = String(Math.log(num(row.gini)));
    row.dr_treated = Number.isFinite(g) && g === bestG ? "1" : "0";
  }
  const path = join(tmpDir, "bank-deregulation.csv");
  writeCsv(path, rows, [
    "statefip",
    "state",
    "wrkyr",
    "log_gini",
    "branch_g",
    "treat_intra",
    "dr_treated",
  ]);
  const drPre = Number.isFinite(bestG) ? bestG - 1 : 1978;
  const drPost = Number.isFinite(bestG) ? bestG : 1979;
  return {
    name: "bank-deregulation",
    title: EXAMPLE_TITLES["bank-deregulation"],
    source,
    path,
    loadArgs: {
      path,
      id_var: "statefip",
      time_var: "wrkyr",
      treat_timing_var: "branch_g",
      treat_var: "treat_intra",
      outcome_var: "log_gini",
    },
    drdid: {
      outcome_var: "log_gini",
      treated_var: "dr_treated",
      time_values: [drPre, drPost],
    },
    skill: {
      csv: path,
      id_var: "statefip",
      time_var: "wrkyr",
      gname_var: "branch_g",
      treat_post_var: "treat_intra",
      outcome_var: "log_gini",
      control_group: "notyettreated",
      weights_var: "",
      has_never_treated: false,
    },
  };
}

const PREPARERS = {
  "medicaid-insurance": prepareMedicaidInsurance,
  "medicaid-mortality": prepareMedicaidMortality,
  "teacher-bargaining": prepareTeacherBargaining,
  "divorce-laws": prepareDivorceLaws,
  "sentencing-laws": prepareSentencingLaws,
  "bank-deregulation": prepareBankDeregulation,
};

export function prepareDidExampleDatasets({ examplesDir, tmpDir, names = EXAMPLE_DATASET_ORDER }) {
  return names.map((name) => {
    const prepare = PREPARERS[name];
    if (!prepare) throw new Error(`unknown DID example dataset: ${name}`);
    return prepare(examplesDir, tmpDir);
  });
}

export function prepareSkillRecipeDatasets(options) {
  return prepareDidExampleDatasets(options).map((prepared) => ({
    name: prepared.name,
    title: prepared.title,
    ...prepared.skill,
  }));
}
