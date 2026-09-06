export type MetricSource = 'business' | 'behavioral';

export interface MetricDefinitionDto {
  id: string;
  name: string;
  source: MetricSource;
  formula: string;
  notes?: string;
}

export const METRIC_DEFINITIONS: MetricDefinitionDto[] = [
  {
    id: 'active_employee',
    name: 'Active employee',
    source: 'behavioral',
    formula:
      'Employee with ≥1 qualifying activity event in the selected period.',
  },
  {
    id: 'dau',
    name: 'Daily active users (DAU)',
    source: 'behavioral',
    formula:
      'Unique employees with ≥1 qualifying activity on a calendar day (UTC).',
  },
  {
    id: 'wau',
    name: 'Weekly active users (WAU)',
    source: 'behavioral',
    formula: 'Unique employees with ≥1 qualifying activity in a 7-day window.',
  },
  {
    id: 'mau',
    name: 'Monthly active users (MAU)',
    source: 'behavioral',
    formula: 'Unique employees with ≥1 qualifying activity in a 30-day window.',
  },
  {
    id: 'gross_purchase_value',
    name: 'Gross purchase value',
    source: 'business',
    formula:
      'Sum of totalKobo on qualifying orders (excludes DRAFT and CANCELLED).',
  },
  {
    id: 'net_purchase_value',
    name: 'Net purchase value',
    source: 'business',
    formula:
      'Gross purchase value minus absolute REFUND ledger amounts in the period.',
  },
  {
    id: 'aov',
    name: 'Average order value',
    source: 'business',
    formula:
      'Sum of qualifying order totalKobo ÷ count of qualifying orders (kobo).',
  },
  {
    id: 'repeat_purchaser',
    name: 'Repeat purchaser',
    source: 'business',
    formula: 'Employee with ≥2 qualifying orders in the analysis period.',
  },
  {
    id: 'repeat_purchase_rate',
    name: 'Repeat purchase rate',
    source: 'business',
    formula:
      'Employees with ≥2 qualifying orders ÷ employees with ≥1 qualifying order.',
  },
  {
    id: 'funnel_conversion',
    name: 'Funnel conversion rate',
    source: 'behavioral',
    formula:
      'Unique employees completing target stage ÷ unique employees at prior stage.',
  },
  {
    id: 'credit_utilization',
    name: 'Credit utilization',
    source: 'business',
    formula: 'Outstanding principal kobo ÷ effective credit limit kobo.',
  },
  {
    id: 'payroll_collection',
    name: 'Payroll collection rate',
    source: 'business',
    formula: 'Collected deduction kobo ÷ expected deduction kobo for the run/period.',
  },
  {
    id: 'purchase_retention',
    name: 'Purchase retention',
    source: 'business',
    formula:
      'Share of a first-purchase cohort that places another order in a later period.',
  },
  {
    id: 'activity_retention',
    name: 'Activity retention (N-day)',
    source: 'behavioral',
    formula:
      'Share of users active on day 0 who have ≥1 qualifying activity within N days.',
  },
  {
    id: 'rfm',
    name: 'RFM segment',
    source: 'business',
    formula:
      'Recency / Frequency / Monetary scores from qualifying order history. Segments are descriptive labels, not credit decisions.',
  },
  {
    id: 'clv_historical',
    name: 'Customer lifetime value (historical)',
    source: 'business',
    formula: 'Sum of qualifying order totals for the employee (actual, not predicted).',
  },
  {
    id: 'clv_estimated',
    name: 'Customer lifetime value (estimated)',
    source: 'business',
    formula:
      'Heuristic: average monthly spend × 12. Always labeled as estimate — never presented as fact.',
  },
  {
    id: 'employer_adoption',
    name: 'Employer adoption rate',
    source: 'behavioral',
    formula: 'Active employees ÷ registered employees for the employer in the period.',
  },
  {
    id: 'search_zero_result_rate',
    name: 'Zero-result search rate',
    source: 'behavioral',
    formula: 'Searches with no results ÷ total searches (unmet demand signal).',
  },
  {
    id: 'product_view_to_purchase',
    name: 'Product view → purchase conversion',
    source: 'behavioral',
    formula:
      'Unique purchasers of a product ÷ unique viewers (requires behavioral collection).',
  },
];

export interface LearningCenterTopic {
  id: string;
  question: string;
  use: string[];
  body: string;
  watch: string[];
  actions: string[];
}

export const LEARNING_CENTER: LearningCenterTopic[] = [
  {
    id: 'sources',
    question: 'Business vs behavioral data',
    use: ['Definitions', 'Overview'],
    body: 'Business metrics come from orders, credit, and payroll tables and include history. Behavioral metrics come from AnalyticsEvent rows collected after deployment. Pre-collection behavioral history is unavailable.',
    watch: ['behavioralNotice on every analytics page'],
    actions: ['Interpret behavioral trends only after collection start'],
  },
  {
    id: 'coming_back',
    question: 'Are customers coming back?',
    use: ['Retention', 'Cohorts', 'Repeat purchases', 'RFM'],
    body: 'Retention shows whether employees continue using Pantri after signup or first purchase. Falling retention usually points to onboarding, assortment, pricing, or payroll friction.',
    watch: ['30-day retention', 'Repeat purchase rate', 'Drop-off after first purchase'],
    actions: [
      'Investigate the affected cohort',
      'Compare employers',
      'Examine products purchased',
      'Check checkout abandonment',
    ],
  },
  {
    id: 'stock',
    question: 'What should we stock?',
    use: ['Search demand', 'Product conversion', 'Sales velocity'],
    body: 'Pantri does not store warehouse inventory. Use search unmet demand, view→purchase conversion, and sales velocity to guide assortment. Household stock is employee pantry data, not supply.',
    watch: ['Zero-result searches', 'Browse-not-buy products', 'Fast-moving SKUs'],
    actions: ['Add missing SKUs for rising zero-result queries', 'Review pricing on high-view low-purchase items'],
  },
  {
    id: 'employers',
    question: 'Which employers should we focus on?',
    use: ['Employer analytics', 'Adoption', 'Revenue', 'Retention'],
    body: 'Compare adoption, purchase frequency, revenue, and payroll collection against the Pantri average and similar-sized employers.',
    watch: ['Adoption vs average', 'Payroll collection rate', 'Outstanding credit exposure'],
    actions: ['Coach underperforming employers', 'Study playbooks from outperforming peers'],
  },
  {
    id: 'sales_fall',
    question: 'Why did sales fall?',
    use: ['What changed', 'Why analysis', 'Active users', 'AOV', 'Employer/product breakdowns'],
    body: 'Start with What Changed, then open Why? to see whether the drop is volume (users/orders), value (AOV), cancellations/refunds, or concentration in specific employers/categories.',
    watch: ['Revenue Δ', 'Active users Δ', 'Order frequency', 'Cancel/refund spikes'],
    actions: ['Drill into top declining employers and categories', 'Check payroll exceptions'],
  },
  {
    id: 'customer_value',
    question: 'Are customers becoming more valuable?',
    use: ['Frequency', 'Monetary', 'Repeat purchases', 'CLV'],
    body: 'Track historical lifetime value separately from estimated CLV. Rising frequency with stable AOV usually beats one-off spikes.',
    watch: ['Repeat purchase rate', 'Historical lifetime kobo', 'Estimated CLV (labeled)'],
    actions: ['Nurture high-value and frequent segments', 'Reactivate dormant / at-risk'],
  },
  {
    id: 'dropoff',
    question: 'Where are customers dropping off?',
    use: ['Funnels', 'Cart abandonment', 'Checkout abandonment'],
    body: 'The biggest funnel drop-off is the primary intervention point. Cart and checkout pages show step-level abandonment.',
    watch: ['Largest stage drop-off', 'Abandon rate', 'Most abandoned products'],
    actions: ['Fix UX/credit blockers on that step', 'Investigate abandoned products'],
  },
  {
    id: 'intervene',
    question: 'Where should management intervene?',
    use: ['Anomalies', 'At-risk users', 'Payroll exceptions', 'Credit indicators', 'Insights'],
    body: 'Unusual patterns and risk indicators are investigative starting points — not fraud verdicts or automated lending decisions.',
    watch: ['Insight cards on Overview', 'Failed deductions', 'At-risk / dormant segments'],
    actions: ['Open linked employee/employer/payroll records in existing admin tools'],
  },
];
