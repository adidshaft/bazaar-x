export type WorldEconomySkillMethod = (...args: readonly unknown[]) => unknown;

export type WorldEconomySkillMethods = Record<string, WorldEconomySkillMethod>;

export interface WorldEconomySkillDescriptor {
  id: string;
  name: string;
  description: string;
  version: string;
  tags: string[];
}

export interface WorldEconomySkill<TMethods extends object = object> {
  id: string;
  name: string;
  description: string;
  version: string;
  tags?: string[];
  methods: TMethods;
}

type AnyWorldEconomySkill = WorldEconomySkill<object>;

export class WorldEconomySkillRegistry {
  private readonly skills = new Map<string, AnyWorldEconomySkill>();

  constructor(initialSkills: AnyWorldEconomySkill[] = []) {
    initialSkills.forEach((skill) => {
      this.register(skill);
    });
  }

  register<TMethods extends object>(skill: WorldEconomySkill<TMethods>) {
    if (this.skills.has(skill.id)) {
      throw new Error(`World economy skill "${skill.id}" is already registered.`);
    }

    this.skills.set(skill.id, skill as AnyWorldEconomySkill);
    return this;
  }

  list() {
    return [...this.skills.values()];
  }

  has(skillId: string) {
    return this.skills.has(skillId);
  }

  get<TMethods extends object = WorldEconomySkillMethods>(skillId: string) {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`World economy skill "${skillId}" is not registered.`);
    }

    return skill as WorldEconomySkill<TMethods>;
  }
}

export function createWorldEconomySkillRegistry(initialSkills: AnyWorldEconomySkill[] = []) {
  return new WorldEconomySkillRegistry(initialSkills);
}

export function describeWorldEconomySkill(skill: AnyWorldEconomySkill): WorldEconomySkillDescriptor {
  return {
    id: skill.id,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    tags: skill.tags ?? [],
  };
}
