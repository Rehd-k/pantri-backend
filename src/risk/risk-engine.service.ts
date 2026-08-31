import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const RISK_RULES = Symbol('RISK_RULES');

export type RiskDecisionCode = 'APPROVE' | 'REQUIRE_APPROVAL' | 'REJECT';

export interface RiskDecision {
  code: RiskDecisionCode;
  reason: string;
}

export interface RiskFactorInput {
  employeeId: string;
  salaryKobo: number;
  employmentDurationDays: number;
  consecutiveMissedDeductions: number;
  /** (principal + reserved) / effective limit, as a whole-number percent. */
  currentUtilizationPercent: number;
  requestedAmountKobo: number;
  availableKobo: number;
}

export interface RiskRuleResult {
  scoreDelta: number;
  decision?: RiskDecision;
}

/** Pluggable unit of risk logic; register additional rules via the `RISK_RULES` DI token. */
export interface RiskRule {
  name: string;
  evaluate(input: RiskFactorInput): RiskRuleResult;
}

export interface RiskEvaluationResult {
  score: number;
  decisions: RiskDecision[];
  overallDecision: RiskDecisionCode;
  factors: Record<string, number>;
}

const utilizationRule: RiskRule = {
  name: 'utilization',
  evaluate: (input) => {
    if (input.currentUtilizationPercent >= 90) {
      return {
        scoreDelta: 30,
        decision: {
          code: 'REQUIRE_APPROVAL',
          reason: 'Credit utilization is at or above 90%',
        },
      };
    }
    if (input.currentUtilizationPercent >= 70) {
      return { scoreDelta: 15 };
    }
    return { scoreDelta: 0 };
  },
};

const missedDeductionsRule: RiskRule = {
  name: 'missedDeductions',
  evaluate: (input) => {
    if (input.consecutiveMissedDeductions >= 3) {
      return {
        scoreDelta: 40,
        decision: {
          code: 'REJECT',
          reason: 'Three or more consecutive missed payroll deductions',
        },
      };
    }
    if (input.consecutiveMissedDeductions >= 1) {
      return {
        scoreDelta: 20,
        decision: {
          code: 'REQUIRE_APPROVAL',
          reason: 'A recent payroll deduction was missed',
        },
      };
    }
    return { scoreDelta: 0 };
  },
};

const tenureRule: RiskRule = {
  name: 'tenure',
  evaluate: (input) => {
    if (input.employmentDurationDays < 30) {
      return {
        scoreDelta: 25,
        decision: {
          code: 'REQUIRE_APPROVAL',
          reason: 'Employee tenure is under 30 days',
        },
      };
    }
    if (input.employmentDurationDays < 90) {
      return { scoreDelta: 10 };
    }
    return { scoreDelta: 0 };
  },
};

const requestSizeRule: RiskRule = {
  name: 'requestSize',
  evaluate: (input) => {
    if (input.requestedAmountKobo > input.availableKobo) {
      return {
        scoreDelta: 50,
        decision: {
          code: 'REJECT',
          reason: 'Requested amount exceeds available credit',
        },
      };
    }
    return { scoreDelta: 0 };
  },
};

export const DEFAULT_RISK_RULES: RiskRule[] = [
  utilizationRule,
  missedDeductionsRule,
  tenureRule,
  requestSizeRule,
];

/**
 * Aggregates a set of pluggable `RiskRule`s into a single score (0-100,
 * higher = riskier) and an overall decision. Swap in a different rule set
 * (e.g. one that calls an ML scoring service) by providing an alternate
 * `RISK_RULES` value in `RiskModule`  nothing else in the codebase needs
 * to change.
 */
@Injectable()
export class RiskEngineService {
  constructor(
    @Inject(RISK_RULES) private readonly rules: RiskRule[],
    private readonly prisma: PrismaService,
  ) {}

  evaluate(input: RiskFactorInput): RiskEvaluationResult {
    let score = 0;
    const decisions: RiskDecision[] = [];
    const factors: Record<string, number> = {};

    for (const rule of this.rules) {
      const result = rule.evaluate(input);
      score += result.scoreDelta;
      factors[rule.name] = result.scoreDelta;
      if (result.decision) {
        decisions.push(result.decision);
      }
    }

    score = Math.max(0, Math.min(100, score));

    if (decisions.length === 0) {
      decisions.push({ code: 'APPROVE', reason: 'No risk flags triggered' });
    }

    return {
      score,
      decisions,
      overallDecision: overallDecisionOf(decisions),
      factors,
    };
  }

  /** Loads live employee/credit-account state, evaluates, and persists the score onto `RiskProfile`. */
  async evaluateForEmployee(
    employeeId: string,
    requestedAmountKobo: number,
  ): Promise<RiskEvaluationResult> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: { creditAccount: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const account = employee.creditAccount;
    const effectiveLimitKobo = account
      ? (account.manualLimitOverrideKobo ?? account.creditLimitKobo)
      : 0;
    const committedKobo = account
      ? account.principalOutstandingKobo + account.reservedKobo
      : 0;
    const currentUtilizationPercent =
      effectiveLimitKobo > 0
        ? Math.round((committedKobo / effectiveLimitKobo) * 100)
        : 0;
    const employmentDurationDays = Math.floor(
      (Date.now() - employee.employmentStartedAt.getTime()) /
        (24 * 60 * 60 * 1000),
    );

    const result = this.evaluate({
      employeeId,
      salaryKobo: employee.salaryKobo,
      employmentDurationDays,
      consecutiveMissedDeductions: account?.consecutiveMissedDeductions ?? 0,
      currentUtilizationPercent,
      requestedAmountKobo,
      availableKobo: account?.availableKobo ?? 0,
    });

    await this.prisma.riskProfile.upsert({
      where: { employeeId },
      create: {
        employeeId,
        score: result.score,
        factors: result.factors,
      },
      update: {
        score: result.score,
        factors: result.factors,
      },
    });

    return result;
  }
}

function overallDecisionOf(decisions: RiskDecision[]): RiskDecisionCode {
  if (decisions.some((d) => d.code === 'REJECT')) return 'REJECT';
  if (decisions.some((d) => d.code === 'REQUIRE_APPROVAL'))
    return 'REQUIRE_APPROVAL';
  return 'APPROVE';
}
