import {
  createCovenantSkill,
  describeWorldEconomySkill,
  createWorldEconomySkillRegistry,
  type CovenantSkillMethods,
  type WorldEconomySkill,
} from '../../covenant-skill';

export function createBazaarSkillRegistry(extraSkills: WorldEconomySkill[] = []) {
  return createWorldEconomySkillRegistry([createCovenantSkill(), ...extraSkills]);
}

export const bazaarSkillRegistry = createBazaarSkillRegistry();

export const covenantWorldSkill = bazaarSkillRegistry.get<CovenantSkillMethods>('covenant-skill');

export const installedWorldEconomySkills = bazaarSkillRegistry.list().map(describeWorldEconomySkill);
