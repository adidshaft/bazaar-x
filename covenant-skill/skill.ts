import {
  applyTax,
  checkBalanceRules,
  createDefaultPolicy,
  enforcePolicy,
  executeChange,
  proposeChange,
  vote,
} from './engine';
import type {
  BalanceSnapshot,
  CovenantState,
  CreateProposalInput,
  GovernanceResult,
  PolicyContext,
  PolicyDecision,
  PolicyRuleSet,
  PolicyTransaction,
  TaxBreakdown,
  VoteChoice,
} from './types';
import type { WorldEconomySkill } from './registry';

export interface CovenantSkillMethods {
  createDefaultPolicy: () => PolicyRuleSet;
  applyTax: (amount: number, policy: PolicyRuleSet) => TaxBreakdown;
  checkBalanceRules: (
    sender: BalanceSnapshot,
    amount: number,
    policy: PolicyRuleSet,
  ) => { allowed: boolean; reason: string | null; postBalance: number };
  enforcePolicy: (
    tx: PolicyTransaction,
    context: PolicyContext,
    policy: PolicyRuleSet,
  ) => PolicyDecision;
  proposeChange: (state: CovenantState, input: CreateProposalInput) => CovenantState;
  vote: (
    state: CovenantState,
    proposalId: string,
    voterId: string,
    choice: VoteChoice,
  ) => CovenantState;
  executeChange: (
    state: CovenantState,
    proposalId: string,
    currentTick: number,
  ) => GovernanceResult;
}

export function createCovenantSkill(): WorldEconomySkill<CovenantSkillMethods> {
  return {
    id: 'covenant-skill',
    name: 'Covenant Skill',
    description:
      'Reusable tax, policy, treasury, and governance logic for world economies and autonomous game markets.',
    version: '0.1.0',
    tags: ['policy', 'treasury', 'governance', 'world-economy', 'games'],
    methods: {
      createDefaultPolicy,
      applyTax,
      checkBalanceRules,
      enforcePolicy,
      proposeChange,
      vote,
      executeChange,
    },
  };
}
