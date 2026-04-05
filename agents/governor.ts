import { AgentDecisionContext, EconomyAction } from '../lib/economy/types';
import { isProposalActive, policyPatchForTick, proposalIdFor } from './deterministic';

export function decideGovernorActions(context: AgentDecisionContext): EconomyAction[] {
  const actions: EconomyAction[] = [];

  if (context.tick === 1 && !isProposalActive(context)) {
    const proposalId = proposalIdFor(context.agent.id, 'tax');
    actions.push({
      type: 'propose_change',
      agentId: context.agent.id,
      proposalId,
      title: 'Raise covenant tax to support the treasury loop',
      description: 'Increase the tax rate after the economy proves it can circulate revenue.',
      patch: policyPatchForTick(context.tick),
    });
  }

  if (context.tick >= 2) {
    const proposal = Object.values(context.state.covenant.proposals).find((entry) => entry.status === 'active');
    if (proposal) {
      actions.push({
        type: 'vote',
        agentId: context.agent.id,
        proposalId: proposal.id,
        choice: 'for',
      });
    }
  }

  if (context.tick === 3) {
    const executed = Object.values(context.state.covenant.proposals).find((entry) => entry.status === 'active' || entry.status === 'passed');
    if (executed) {
      actions.push({
        type: 'execute_change',
        agentId: context.agent.id,
        proposalId: executed.id,
      });
    }
  }

  return actions;
}
