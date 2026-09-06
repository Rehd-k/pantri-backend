/**
 * Canonical Pantri analytics event taxonomy.
 * Clients and server MUST use these exact strings — do not invent ad-hoc names.
 */

export const EmployeeAnalyticsEvents = {
  ACCOUNT_CREATED: 'employee.account_created',
  INVITATION_ACCEPTED: 'employee.invitation_accepted',
  REGISTRATION_COMPLETED: 'employee.registration_completed',
  PROFILE_COMPLETED: 'employee.profile_completed',
  ACCOUNT_ACTIVATED: 'employee.account_activated',
  ACCOUNT_DEACTIVATED: 'employee.account_deactivated',
  APP_OPENED: 'employee.app_opened',
  SESSION_STARTED: 'employee.session_started',
  SESSION_ENDED: 'employee.session_ended',
  LOGIN: 'employee.login',
  LOGOUT: 'employee.logout',
  CATEGORY_VIEWED: 'employee.category_viewed',
  PRODUCT_VIEWED: 'employee.product_viewed',
  SEARCH_SUBMITTED: 'employee.search_submitted',
  SEARCH_RESULTS: 'employee.search_results',
  SEARCH_NO_RESULTS: 'employee.search_no_results',
  PRODUCT_ADDED_TO_CART: 'employee.product_added_to_cart',
  PRODUCT_REMOVED_FROM_CART: 'employee.product_removed_from_cart',
  CART_VIEWED: 'employee.cart_viewed',
  CHECKOUT_STARTED: 'employee.checkout_started',
  CHECKOUT_STEP_COMPLETED: 'employee.checkout_step_completed',
  CHECKOUT_ABANDONED: 'employee.checkout_abandoned',
  ORDER_SUBMITTED: 'employee.order_submitted',
  ORDER_COMPLETED: 'employee.order_completed',
  ORDER_CANCELLED: 'employee.order_cancelled',
  ORDER_DELIVERED: 'employee.order_delivered',
  ORDER_PARTIALLY_FULFILLED: 'employee.order_partially_fulfilled',
  REFUND_ISSUED: 'employee.refund_issued',
  ORDER_VIEWED: 'employee.order_viewed',
  CREDIT_VIEWED: 'employee.credit_viewed',
  CREDIT_LIMIT_VIEWED: 'employee.credit_limit_viewed',
  AVAILABLE_CREDIT_VIEWED: 'employee.available_credit_viewed',
  PAYROLL_INFO_VIEWED: 'employee.payroll_info_viewed',
  NOTIFICATION_OPENED: 'employee.notification_opened',
  NOTIFICATION_IGNORED: 'employee.notification_ignored',
  CTA_CLICKED: 'employee.cta_clicked',
} as const;

export const EmployerAnalyticsEvents = {
  ACCOUNT_CREATED: 'employer.account_created',
  ACTIVATED: 'employer.activated',
  LOGIN: 'employer.login',
  DASHBOARD_VIEWED: 'employer.dashboard_viewed',
  EMPLOYEE_LIST_VIEWED: 'employer.employee_list_viewed',
  EMPLOYEE_INVITED: 'employer.employee_invited',
  EMPLOYEE_ACTIVATED: 'employer.employee_activated',
  PAYROLL_VIEWED: 'employer.payroll_viewed',
  PAYROLL_SUBMITTED: 'employer.payroll_submitted',
  PAYROLL_PROCESSED: 'employer.payroll_processed',
  PAYROLL_RECONCILIATION_VIEWED: 'employer.payroll_reconciliation_viewed',
  ORDERS_VIEWED: 'employer.orders_viewed',
  ORDER_APPROVED: 'employer.order_approved',
  ORDER_REJECTED: 'employer.order_rejected',
  POLICY_VIEWED: 'employer.policy_viewed',
  REPORT_VIEWED: 'employer.report_viewed',
  EXPORT_PERFORMED: 'employer.export_performed',
  ANALYTICS_VIEWED: 'employer.analytics_viewed',
  INVOICES_VIEWED: 'employer.invoices_viewed',
} as const;

export type EmployeeAnalyticsEventName =
  (typeof EmployeeAnalyticsEvents)[keyof typeof EmployeeAnalyticsEvents];

export type EmployerAnalyticsEventName =
  (typeof EmployerAnalyticsEvents)[keyof typeof EmployerAnalyticsEvents];

export type AnalyticsEventName =
  | EmployeeAnalyticsEventName
  | EmployerAnalyticsEventName;

export const ALL_ANALYTICS_EVENTS: readonly AnalyticsEventName[] = [
  ...Object.values(EmployeeAnalyticsEvents),
  ...Object.values(EmployerAnalyticsEvents),
];

export const ANALYTICS_EVENT_SET = new Set<string>(ALL_ANALYTICS_EVENTS);

/** Events that count toward DAU / active-user metrics (excludes pure session_ended noise). */
export const QUALIFYING_ACTIVITY_EVENTS: ReadonlySet<string> = new Set([
  EmployeeAnalyticsEvents.APP_OPENED,
  EmployeeAnalyticsEvents.SESSION_STARTED,
  EmployeeAnalyticsEvents.LOGIN,
  EmployeeAnalyticsEvents.CATEGORY_VIEWED,
  EmployeeAnalyticsEvents.PRODUCT_VIEWED,
  EmployeeAnalyticsEvents.SEARCH_SUBMITTED,
  EmployeeAnalyticsEvents.SEARCH_RESULTS,
  EmployeeAnalyticsEvents.SEARCH_NO_RESULTS,
  EmployeeAnalyticsEvents.PRODUCT_ADDED_TO_CART,
  EmployeeAnalyticsEvents.PRODUCT_REMOVED_FROM_CART,
  EmployeeAnalyticsEvents.CART_VIEWED,
  EmployeeAnalyticsEvents.CHECKOUT_STARTED,
  EmployeeAnalyticsEvents.CHECKOUT_STEP_COMPLETED,
  EmployeeAnalyticsEvents.ORDER_SUBMITTED,
  EmployeeAnalyticsEvents.ORDER_VIEWED,
  EmployeeAnalyticsEvents.CREDIT_VIEWED,
  EmployeeAnalyticsEvents.PAYROLL_INFO_VIEWED,
  EmployeeAnalyticsEvents.NOTIFICATION_OPENED,
  EmployeeAnalyticsEvents.CTA_CLICKED,
  EmployerAnalyticsEvents.LOGIN,
  EmployerAnalyticsEvents.DASHBOARD_VIEWED,
  EmployerAnalyticsEvents.EMPLOYEE_LIST_VIEWED,
  EmployerAnalyticsEvents.EMPLOYEE_INVITED,
  EmployerAnalyticsEvents.PAYROLL_VIEWED,
  EmployerAnalyticsEvents.PAYROLL_SUBMITTED,
  EmployerAnalyticsEvents.ORDERS_VIEWED,
  EmployerAnalyticsEvents.ORDER_APPROVED,
  EmployerAnalyticsEvents.ORDER_REJECTED,
  EmployerAnalyticsEvents.POLICY_VIEWED,
  EmployerAnalyticsEvents.REPORT_VIEWED,
  EmployerAnalyticsEvents.EXPORT_PERFORMED,
  EmployerAnalyticsEvents.ANALYTICS_VIEWED,
]);

export const FUNNEL_EVENTS = {
  registered: EmployeeAnalyticsEvents.REGISTRATION_COMPLETED,
  activated: EmployeeAnalyticsEvents.ACCOUNT_ACTIVATED,
  appOpened: EmployeeAnalyticsEvents.APP_OPENED,
  productViewed: EmployeeAnalyticsEvents.PRODUCT_VIEWED,
  addedToCart: EmployeeAnalyticsEvents.PRODUCT_ADDED_TO_CART,
  checkoutStarted: EmployeeAnalyticsEvents.CHECKOUT_STARTED,
  orderSubmitted: EmployeeAnalyticsEvents.ORDER_SUBMITTED,
} as const;

/** Auto customer segment keys (nightly membership). */
export const CustomerSegmentKeys = {
  NEW: 'new',
  ACTIVE: 'active',
  HIGH_VALUE: 'high_value',
  FREQUENT: 'frequent',
  DORMANT: 'dormant',
  AT_RISK: 'at_risk',
  REACTIVATED: 'reactivated',
  CREDIT_HEAVY: 'credit_heavy',
  LOW_UTILIZATION: 'low_utilization',
  CHAMPIONS: 'champions',
  LOYAL: 'loyal',
  LOST: 'lost',
} as const;

export type CustomerSegmentKey =
  (typeof CustomerSegmentKeys)[keyof typeof CustomerSegmentKeys];

/** Daily rollup metric keys (behavioral + business). */
export const RollupMetricKeys = {
  DAU: 'dau',
  SESSIONS: 'sessions',
  PRODUCT_VIEWS: 'product_views',
  ADD_TO_CART: 'add_to_cart',
  CHECKOUT_STARTED: 'checkout_started',
  ORDERS_SUBMITTED: 'orders_submitted',
  SEARCHES: 'searches',
  SEARCH_ZERO_RESULTS: 'search_zero_results',
  EVENT_COUNT: 'event_count',
  REVENUE_KOBO: 'revenue_kobo',
  ORDER_COUNT: 'order_count',
  AOV_KOBO: 'aov_kobo',
  NEW_EMPLOYEES: 'new_employees',
  NEW_EMPLOYERS: 'new_employers',
  CANCELLED_ORDERS: 'cancelled_orders',
  REFUND_KOBO: 'refund_kobo',
  PAYROLL_EXPECTED_KOBO: 'payroll_expected_kobo',
  PAYROLL_COLLECTED_KOBO: 'payroll_collected_kobo',
  SEGMENT_COUNTS: 'segment_counts',
} as const;

export function isKnownAnalyticsEvent(name: string): name is AnalyticsEventName {
  return ANALYTICS_EVENT_SET.has(name);
}
