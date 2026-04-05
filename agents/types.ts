import type { AgentDecisionContext, EconomyAction, EconomyState } from '../lib/economy/types';
import type { GovernancePatch, VoteChoice } from '../covenant-skill/types';

export type { AgentDecisionContext, EconomyAction, EconomyState };
export type AgentPlanner = (context: AgentDecisionContext) => EconomyAction[];

export interface RolePlanHint {
  focus: string;
  budgetFloor: number;
  budgetCeiling: number;
  preferredActions: Array<EconomyAction['type']>;
}

export interface DeteministicProposalPlan {
  proposalId: string;
  title: string;
  description: string;
  patch: GovernancePatch;
}

export type DeterministicVote = VoteChoice;
