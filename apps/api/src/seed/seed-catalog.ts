export type Level = 'junior' | 'mid' | 'senior' | 'lead' | 'principal';

export interface CountryProfile {
  code: string;
  /** Share of all employees. The shares add up to 1. */
  share: number;
  /** Annual salary of a mid-level engineer, in local currency major units. */
  midLevelBase: number;
  /** Salaries are rounded to a multiple of this, in major units. */
  roundTo: number;
}

export const COUNTRY_PROFILES: readonly CountryProfile[] = [
  { code: 'IN', share: 0.42, midLevelBase: 1_800_000, roundTo: 5_000 },
  { code: 'US', share: 0.265, midLevelBase: 120_000, roundTo: 500 },
  { code: 'GB', share: 0.135, midLevelBase: 60_000, roundTo: 500 },
  { code: 'DE', share: 0.11, midLevelBase: 68_000, roundTo: 500 },
  { code: 'SG', share: 0.07, midLevelBase: 90_000, roundTo: 500 },
];

/** How pay scales with seniority, and how common each level is. */
export const LEVELS: Record<Level, { payFactor: number; weight: number }> = {
  junior: { payFactor: 0.7, weight: 22 },
  mid: { payFactor: 1, weight: 38 },
  senior: { payFactor: 1.45, weight: 26 },
  lead: { payFactor: 1.9, weight: 10 },
  principal: { payFactor: 2.5, weight: 4 },
};

export interface DepartmentProfile {
  name: string;
  /** Relative headcount. */
  weight: number;
  /** Pay relative to Engineering at the same level. */
  payFactor: number;
  titles: readonly (readonly [title: string, level: Level])[];
}

export const DEPARTMENTS: readonly DepartmentProfile[] = [
  {
    name: 'Engineering',
    weight: 30,
    payFactor: 1,
    titles: [
      ['Junior Software Engineer', 'junior'],
      ['Software Engineer', 'mid'],
      ['Senior Software Engineer', 'senior'],
      ['Staff Engineer', 'lead'],
      ['Principal Engineer', 'principal'],
      ['Engineering Manager', 'lead'],
      ['QA Engineer', 'mid'],
      ['Senior QA Engineer', 'senior'],
      ['DevOps Engineer', 'mid'],
      ['Senior DevOps Engineer', 'senior'],
      ['Data Engineer', 'mid'],
      ['Senior Data Engineer', 'senior'],
    ],
  },
  {
    name: 'Product',
    weight: 6,
    payFactor: 1.05,
    titles: [
      ['Associate Product Manager', 'junior'],
      ['Product Analyst', 'mid'],
      ['Product Manager', 'mid'],
      ['Senior Product Manager', 'senior'],
      ['Group Product Manager', 'lead'],
      ['Director of Product', 'principal'],
    ],
  },
  {
    name: 'Design',
    weight: 6,
    payFactor: 0.9,
    titles: [
      ['Junior Designer', 'junior'],
      ['Product Designer', 'mid'],
      ['UX Researcher', 'mid'],
      ['Senior Product Designer', 'senior'],
      ['Lead Designer', 'lead'],
      ['Design Manager', 'lead'],
    ],
  },
  {
    name: 'Sales',
    weight: 16,
    payFactor: 0.85,
    titles: [
      ['Sales Development Representative', 'junior'],
      ['Account Executive', 'mid'],
      ['Account Manager', 'mid'],
      ['Sales Operations Analyst', 'mid'],
      ['Sales Engineer', 'senior'],
      ['Senior Account Executive', 'senior'],
      ['Sales Manager', 'lead'],
      ['Regional Sales Director', 'principal'],
    ],
  },
  {
    name: 'Marketing',
    weight: 8,
    payFactor: 0.8,
    titles: [
      ['Marketing Associate', 'junior'],
      ['Marketing Specialist', 'mid'],
      ['Content Strategist', 'mid'],
      ['Growth Marketing Manager', 'senior'],
      ['Brand Manager', 'senior'],
      ['Marketing Manager', 'lead'],
      ['Head of Marketing', 'principal'],
    ],
  },
  {
    name: 'Finance',
    weight: 8,
    payFactor: 0.85,
    titles: [
      ['Junior Accountant', 'junior'],
      ['Accountant', 'mid'],
      ['Financial Analyst', 'mid'],
      ['Senior Accountant', 'senior'],
      ['Senior Financial Analyst', 'senior'],
      ['Finance Manager', 'lead'],
      ['Financial Controller', 'principal'],
    ],
  },
  {
    name: 'People',
    weight: 6,
    payFactor: 0.75,
    titles: [
      ['HR Coordinator', 'junior'],
      ['HR Generalist', 'mid'],
      ['Recruiter', 'mid'],
      ['Senior Recruiter', 'senior'],
      ['HR Business Partner', 'senior'],
      ['People Operations Manager', 'lead'],
      ['Head of People', 'principal'],
    ],
  },
  {
    name: 'Customer Support',
    weight: 20,
    payFactor: 0.7,
    titles: [
      ['Support Associate', 'junior'],
      ['Support Specialist', 'mid'],
      ['Technical Support Engineer', 'mid'],
      ['Senior Support Specialist', 'senior'],
      ['Customer Success Manager', 'senior'],
      ['Support Team Lead', 'lead'],
      ['Head of Customer Support', 'principal'],
    ],
  },
];

export const EMPLOYMENT_TYPE_WEIGHTS = [
  { value: 'FULL_TIME', weight: 86 },
  { value: 'PART_TIME', weight: 6 },
  { value: 'CONTRACTOR', weight: 8 },
] as const;

export const RAISE_REASONS = [
  'Annual performance review',
  'Annual merit increase',
  'Promotion',
  'Market adjustment',
  'Cost of living adjustment',
  'Retention adjustment',
  'Expanded role and responsibilities',
  'Pay equity adjustment',
] as const;

// Faker has no Singapore locale, so Singapore draws from these.
export const SINGAPORE_FIRST_NAMES = [
  'Wei Ling',
  'Jia Hui',
  'Kai Xin',
  'Hui Min',
  'Zhi Hao',
  'Jun Jie',
  'Wei Jie',
  'Xin Yi',
  'Li Ting',
  'Yong Sheng',
  'Siti',
  'Nurul',
  'Aisyah',
  'Farah',
  'Ahmad',
  'Faizal',
  'Hakim',
  'Irfan',
  'Priya',
  'Kavitha',
  'Deepa',
  'Arjun',
  'Ravi',
  'Suresh',
  'Rachel',
  'Daniel',
  'Grace',
  'Marcus',
] as const;

export const SINGAPORE_LAST_NAMES = [
  'Tan',
  'Lim',
  'Lee',
  'Ng',
  'Ong',
  'Wong',
  'Goh',
  'Chua',
  'Chan',
  'Koh',
  'Teo',
  'Yeo',
  'Low',
  'Ho',
  'Abdullah',
  'Rahman',
  'Ismail',
  'Hassan',
  'Pillai',
  'Nair',
  'Menon',
  'Krishnan',
] as const;
