// ============================================================================
// CORE TYPES
// ============================================================================

export interface Vector2 {
  x: number;
  y: number;
}

export interface GridPosition {
  gridX: number;
  gridY: number;
}

// ============================================================================
// RESOURCES
// ============================================================================

export type ResourceType =
  // Tier 1 - Raw
  | 'iron_ore'
  | 'copper_ore'
  | 'coal'
  | 'stone'
  | 'water'
  // Tier 2 - Processed
  | 'iron_ingot'
  | 'copper_ingot'
  | 'copper_wire'
  | 'silicon'
  // Tier 3 - Advanced
  | 'steel'
  | 'circuits'
  | 'glass'
  // Rare (from waves)
  | 'biomass'
  | 'crystal_shards'
  | 'dark_matter'
  | 'void_essence';

export interface ResourceStack {
  type: ResourceType;
  amount: number;
}

export interface Recipe {
  inputs: ResourceStack[];
  outputs: ResourceStack[];
  craftTime: number; // in game ticks
}

// ============================================================================
// BUILDINGS
// ============================================================================

export type BuildingType =
  // Extractors
  | 'ore_extractor'
  | 'pump'
  | 'solar_collector'
  // Production
  | 'smelter'
  | 'assembler'
  | 'ammo_factory'
  | 'refinery'
  // Logistics
  | 'conveyor'
  | 'conveyor_junction'
  | 'conveyor_router'
  | 'drone_hub'
  | 'storage'
  // Defense
  | 'turret_base'
  | 'wall'
  | 'wall_turret'
  // Power
  | 'coal_generator'
  | 'steam_generator'
  | 'fusion_reactor'
  // Utility
  | 'research_lab'
  | 'repair_station'
  | 'core'; // Main base core

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Building {
  id: string;
  type: BuildingType;
  gridX: number;
  gridY: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  direction: Direction;
  powered: boolean;
  // Production state
  inputStorage: ResourceStack[];
  outputStorage: ResourceStack[];
  craftProgress: number;
  currentRecipe: Recipe | null;
  // Upgrades
  level: number;
}

export interface ConveyorBuilding extends Building {
  type: 'conveyor' | 'conveyor_junction' | 'conveyor_router';
  items: ConveyorItem[];
}

export interface ConveyorItem {
  resource: ResourceType;
  progress: number; // 0-1, position along conveyor
}

export interface TurretBuilding extends Building {
  type: 'turret_base' | 'wall_turret';
  barrelType: TurretBarrelType;
  modules: TurretModule[];
  targetId: string | null;
  cooldown: number;
  ammoType: ResourceType | null;
  ammoCount: number;
}

export type TurretBarrelType = 'mg' | 'cannon' | 'laser' | 'missile';
export type TurretModule = 'range_boost' | 'damage_boost' | 'fire_rate' | 'armor_piercing';

export interface GeneratorBuilding extends Building {
  type: 'coal_generator' | 'steam_generator' | 'fusion_reactor';
  powerRadius: number;
  fuelStored: number;
}

export interface DroneHubBuilding extends Building {
  type: 'drone_hub';
  drones: Drone[];
  maxDrones: number;
}

export interface Drone {
  id: string;
  position: Vector2;
  targetBuilding: string | null;
  carrying: ResourceStack | null;
  state: 'idle' | 'pickup' | 'deliver' | 'returning';
}

// ============================================================================
// TILES
// ============================================================================

export type TileType =
  | 'grass'
  | 'dirt'
  | 'stone_floor'
  | 'water'
  | 'iron_deposit'
  | 'copper_deposit'
  | 'coal_deposit'
  | 'stone_deposit'
  | 'void'; // Outside buildable area

export interface Tile {
  type: TileType;
  buildable: boolean;
  resourceYield?: number; // For deposits
}

// ============================================================================
// PLAYER
// ============================================================================

export type WeaponType =
  | 'basic_rifle'
  | 'shotgun'
  | 'sniper'
  | 'flamethrower'
  | 'rocket_launcher'
  | 'plasma_cannon'
  | 'void_beam';

export type AbilityType =
  | 'dash'
  | 'shield'
  | 'overdrive'
  | 'emp'
  | 'turret_boost';

export interface Weapon {
  type: WeaponType;
  damage: number;
  fireRate: number; // shots per second
  range: number;
  projectileSpeed: number;
  spread: number; // degrees
  projectileCount: number;
  piercing: boolean;
  explosive: boolean;
  explosionRadius: number;
}

export interface Ability {
  type: AbilityType;
  cooldown: number;
  duration: number;
  cost: number; // energy cost
}

export interface Player {
  position: Vector2;
  velocity: Vector2;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  // Combat
  currentWeapon: WeaponType;
  weapons: WeaponType[];
  abilities: AbilityType[];
  abilityStates: Record<AbilityType, { cooldownRemaining: number; active: boolean; activeRemaining: number }>;
  // State
  isDead: boolean;
  respawnTimer: number;
  invincible: boolean;
  invincibleTimer: number;
  // Buffs
  damageMultiplier: number;
  speedMultiplier: number;
  // Mode
  commanderMode: boolean;
}

// ============================================================================
// ENEMIES
// ============================================================================

export type EnemyFaction = 'hive' | 'machines' | 'void';

export type EnemyType =
  // Hive
  | 'swarmer'
  | 'spitter'
  | 'brute'
  | 'queen'
  // Machines
  | 'drone'
  | 'walker'
  | 'tank'
  | 'overseer'
  // Void
  | 'wraith'
  | 'corruptor'
  | 'void_lord';

export type EnemyTargetBehavior =
  | 'nearest'
  | 'core'
  | 'turrets'
  | 'generators'
  | 'smart';

export interface Enemy {
  id: string;
  type: EnemyType;
  faction: EnemyFaction;
  position: Vector2;
  velocity: Vector2;
  hp: number;
  maxHp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  currentCooldown: number;
  targetBehavior: EnemyTargetBehavior;
  targetId: string | null;
  // Special abilities
  canFly: boolean;
  canPhase: boolean; // Pass through walls
  // Boss
  isBoss: boolean;
  // Loot
  lootTable: ResourceStack[];
}

// ============================================================================
// WAVES
// ============================================================================

export type WaveModifier =
  | 'swarm'      // +50% enemies
  | 'armored'    // +100% HP
  | 'fast'       // +50% speed
  | 'regenerating'
  | 'boss';

export interface WaveConfig {
  id: string;
  name: string;
  description: string;
  faction: EnemyFaction;
  baseCost: ResourceStack[];
  baseReward: ResourceStack[];
  enemyTypes: { type: EnemyType; count: number }[];
  availableModifiers: WaveModifier[];
}

export interface ActiveWave {
  config: WaveConfig;
  modifiers: WaveModifier[];
  enemiesRemaining: number;
  totalEnemies: number;
  spawnTimer: number;
  completed: boolean;
}

// ============================================================================
// RESEARCH
// ============================================================================

export type ResearchBranch =
  | 'production'
  | 'logistics'
  | 'defense'
  | 'weapons'
  | 'power'
  | 'summoning';

export interface ResearchNode {
  id: string;
  name: string;
  description: string;
  branch: ResearchBranch;
  cost: ResourceStack[];
  researchTime: number;
  prerequisites: string[];
  unlocks: string[]; // Building types, weapons, abilities, etc.
}

// ============================================================================
// PRESTIGE
// ============================================================================

export interface PrestigeUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number; // Prestige points
  maxLevel: number;
  effect: { type: string; value: number };
}

export interface PrestigeState {
  points: number;
  totalEarned: number;
  upgrades: Record<string, number>; // upgrade id -> level
}

// ============================================================================
// GAME STATE
// ============================================================================

export interface GameState {
  // Time
  tick: number;
  paused: boolean;
  gameSpeed: number;

  // Map
  mapWidth: number;
  mapHeight: number;
  tiles: Tile[][];
  buildings: Map<string, Building>;

  // Resources
  resources: Record<ResourceType, number>;

  // Player
  player: Player;

  // Enemies
  enemies: Map<string, Enemy>;
  activeWave: ActiveWave | null;
  wavesCompleted: number;

  // Projectiles
  projectiles: Projectile[];

  // Research
  completedResearch: Set<string>;
  currentResearch: { nodeId: string; progress: number } | null;

  // Prestige
  prestige: PrestigeState;

  // Unlocks
  unlockedBuildings: Set<BuildingType>;
  unlockedWeapons: Set<WeaponType>;
  unlockedAbilities: Set<AbilityType>;

  // Base expansion
  baseRadius: number; // Tiles from core that are buildable

  // Camera
  camera: {
    x: number;
    y: number;
    zoom: number;
  };

  // Input state
  input: InputState;

  // UI state
  selectedBuilding: BuildingType | null;
  placementDirection: Direction;
  hoveredTile: GridPosition | null;
  showBuildMenu: boolean;
  showWaveMenu: boolean;
  showResearchMenu: boolean;
}

export interface Projectile {
  id: string;
  position: Vector2;
  velocity: Vector2;
  damage: number;
  owner: 'player' | 'turret' | 'enemy';
  piercing: boolean;
  explosive: boolean;
  explosionRadius: number;
  hitEnemies: Set<string>; // For piercing, track what we've hit
  lifetime: number;
}

export interface InputState {
  keys: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseWorldX: number;
  mouseWorldY: number;
  mouseDown: boolean;
  rightMouseDown: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const TILE_SIZE = 22;
export const TICKS_PER_SECOND = 60;

export const BUILDING_DEFINITIONS: Record<BuildingType, {
  name: string;
  width: number;
  height: number;
  maxHp: number;
  cost: ResourceStack[];
  powerRequired: boolean;
  category: 'extraction' | 'production' | 'logistics' | 'defense' | 'power' | 'utility';
}> = {
  core: {
    name: 'Core',
    width: 3,
    height: 3,
    maxHp: 1000,
    cost: [],
    powerRequired: false,
    category: 'utility',
  },
  ore_extractor: {
    name: 'Ore Extractor',
    width: 2,
    height: 2,
    maxHp: 100,
    cost: [{ type: 'iron_ingot', amount: 10 }],
    powerRequired: true,
    category: 'extraction',
  },
  pump: {
    name: 'Pump',
    width: 2,
    height: 2,
    maxHp: 80,
    cost: [{ type: 'iron_ingot', amount: 8 }, { type: 'copper_wire', amount: 5 }],
    powerRequired: true,
    category: 'extraction',
  },
  solar_collector: {
    name: 'Solar Collector',
    width: 2,
    height: 2,
    maxHp: 50,
    cost: [{ type: 'glass', amount: 10 }, { type: 'copper_wire', amount: 5 }],
    powerRequired: false,
    category: 'power',
  },
  smelter: {
    name: 'Smelter',
    width: 2,
    height: 2,
    maxHp: 150,
    cost: [{ type: 'stone', amount: 20 }, { type: 'iron_ingot', amount: 5 }],
    powerRequired: true,
    category: 'production',
  },
  assembler: {
    name: 'Assembler',
    width: 3,
    height: 3,
    maxHp: 200,
    cost: [{ type: 'iron_ingot', amount: 20 }, { type: 'copper_wire', amount: 10 }],
    powerRequired: true,
    category: 'production',
  },
  ammo_factory: {
    name: 'Ammo Factory',
    width: 2,
    height: 2,
    maxHp: 120,
    cost: [{ type: 'iron_ingot', amount: 15 }, { type: 'circuits', amount: 5 }],
    powerRequired: true,
    category: 'production',
  },
  refinery: {
    name: 'Refinery',
    width: 3,
    height: 3,
    maxHp: 250,
    cost: [{ type: 'steel', amount: 30 }, { type: 'circuits', amount: 15 }],
    powerRequired: true,
    category: 'production',
  },
  conveyor: {
    name: 'Conveyor',
    width: 1,
    height: 1,
    maxHp: 20,
    cost: [{ type: 'iron_ingot', amount: 1 }],
    powerRequired: false,
    category: 'logistics',
  },
  conveyor_junction: {
    name: 'Junction',
    width: 1,
    height: 1,
    maxHp: 25,
    cost: [{ type: 'iron_ingot', amount: 2 }],
    powerRequired: false,
    category: 'logistics',
  },
  conveyor_router: {
    name: 'Router',
    width: 1,
    height: 1,
    maxHp: 25,
    cost: [{ type: 'iron_ingot', amount: 2 }, { type: 'copper_wire', amount: 1 }],
    powerRequired: false,
    category: 'logistics',
  },
  drone_hub: {
    name: 'Drone Hub',
    width: 2,
    height: 2,
    maxHp: 150,
    cost: [{ type: 'steel', amount: 20 }, { type: 'circuits', amount: 10 }],
    powerRequired: true,
    category: 'logistics',
  },
  storage: {
    name: 'Storage',
    width: 2,
    height: 2,
    maxHp: 100,
    cost: [{ type: 'iron_ingot', amount: 15 }],
    powerRequired: false,
    category: 'logistics',
  },
  turret_base: {
    name: 'Turret',
    width: 2,
    height: 2,
    maxHp: 200,
    cost: [{ type: 'iron_ingot', amount: 20 }, { type: 'copper_wire', amount: 10 }],
    powerRequired: true,
    category: 'defense',
  },
  wall: {
    name: 'Wall',
    width: 1,
    height: 1,
    maxHp: 500,
    cost: [{ type: 'stone', amount: 5 }],
    powerRequired: false,
    category: 'defense',
  },
  wall_turret: {
    name: 'Wall Turret',
    width: 1,
    height: 1,
    maxHp: 300,
    cost: [{ type: 'steel', amount: 10 }, { type: 'circuits', amount: 3 }],
    powerRequired: true,
    category: 'defense',
  },
  coal_generator: {
    name: 'Coal Generator',
    width: 2,
    height: 2,
    maxHp: 120,
    cost: [{ type: 'iron_ingot', amount: 15 }, { type: 'stone', amount: 10 }],
    powerRequired: false,
    category: 'power',
  },
  steam_generator: {
    name: 'Steam Generator',
    width: 3,
    height: 3,
    maxHp: 200,
    cost: [{ type: 'steel', amount: 25 }, { type: 'copper_wire', amount: 15 }],
    powerRequired: false,
    category: 'power',
  },
  fusion_reactor: {
    name: 'Fusion Reactor',
    width: 4,
    height: 4,
    maxHp: 500,
    cost: [{ type: 'steel', amount: 100 }, { type: 'circuits', amount: 50 }, { type: 'dark_matter', amount: 10 }],
    powerRequired: false,
    category: 'power',
  },
  research_lab: {
    name: 'Research Lab',
    width: 3,
    height: 3,
    maxHp: 150,
    cost: [{ type: 'iron_ingot', amount: 30 }, { type: 'circuits', amount: 20 }],
    powerRequired: true,
    category: 'utility',
  },
  repair_station: {
    name: 'Repair Station',
    width: 2,
    height: 2,
    maxHp: 100,
    cost: [{ type: 'iron_ingot', amount: 20 }, { type: 'circuits', amount: 10 }],
    powerRequired: true,
    category: 'utility',
  },
};

export const WEAPON_DEFINITIONS: Record<WeaponType, Weapon> = {
  basic_rifle: {
    type: 'basic_rifle',
    damage: 10,
    fireRate: 5,
    range: 300,
    projectileSpeed: 800,
    spread: 2,
    projectileCount: 1,
    piercing: false,
    explosive: false,
    explosionRadius: 0,
  },
  shotgun: {
    type: 'shotgun',
    damage: 8,
    fireRate: 1.5,
    range: 150,
    projectileSpeed: 600,
    spread: 20,
    projectileCount: 6,
    piercing: false,
    explosive: false,
    explosionRadius: 0,
  },
  sniper: {
    type: 'sniper',
    damage: 80,
    fireRate: 0.5,
    range: 600,
    projectileSpeed: 1500,
    spread: 0,
    projectileCount: 1,
    piercing: true,
    explosive: false,
    explosionRadius: 0,
  },
  flamethrower: {
    type: 'flamethrower',
    damage: 5,
    fireRate: 20,
    range: 120,
    projectileSpeed: 400,
    spread: 15,
    projectileCount: 1,
    piercing: true,
    explosive: false,
    explosionRadius: 0,
  },
  rocket_launcher: {
    type: 'rocket_launcher',
    damage: 100,
    fireRate: 0.8,
    range: 400,
    projectileSpeed: 500,
    spread: 0,
    projectileCount: 1,
    piercing: false,
    explosive: true,
    explosionRadius: 60,
  },
  plasma_cannon: {
    type: 'plasma_cannon',
    damage: 50,
    fireRate: 2,
    range: 350,
    projectileSpeed: 700,
    spread: 0,
    projectileCount: 1,
    piercing: true,
    explosive: false,
    explosionRadius: 0,
  },
  void_beam: {
    type: 'void_beam',
    damage: 200,
    fireRate: 0.3,
    range: 500,
    projectileSpeed: 2000,
    spread: 0,
    projectileCount: 1,
    piercing: true,
    explosive: true,
    explosionRadius: 40,
  },
};

export const ENEMY_DEFINITIONS: Record<EnemyType, {
  name: string;
  faction: EnemyFaction;
  hp: number;
  damage: number;
  speed: number;
  attackRange: number;
  targetBehavior: EnemyTargetBehavior;
  canFly: boolean;
  canPhase: boolean;
  isBoss: boolean;
  lootTable: ResourceStack[];
}> = {
  // Hive
  swarmer: {
    name: 'Swarmer',
    faction: 'hive',
    hp: 20,
    damage: 5,
    speed: 100,
    attackRange: 20,
    targetBehavior: 'nearest',
    canFly: false,
    canPhase: false,
    isBoss: false,
    lootTable: [{ type: 'biomass', amount: 1 }],
  },
  spitter: {
    name: 'Spitter',
    faction: 'hive',
    hp: 40,
    damage: 15,
    speed: 60,
    attackRange: 150,
    targetBehavior: 'turrets',
    canFly: false,
    canPhase: false,
    isBoss: false,
    lootTable: [{ type: 'biomass', amount: 2 }],
  },
  brute: {
    name: 'Brute',
    faction: 'hive',
    hp: 200,
    damage: 30,
    speed: 40,
    attackRange: 30,
    targetBehavior: 'core',
    canFly: false,
    canPhase: false,
    isBoss: false,
    lootTable: [{ type: 'biomass', amount: 5 }],
  },
  queen: {
    name: 'Hive Queen',
    faction: 'hive',
    hp: 1000,
    damage: 50,
    speed: 30,
    attackRange: 40,
    targetBehavior: 'smart',
    canFly: false,
    canPhase: false,
    isBoss: true,
    lootTable: [{ type: 'biomass', amount: 20 }, { type: 'crystal_shards', amount: 5 }],
  },
  // Machines
  drone: {
    name: 'Drone',
    faction: 'machines',
    hp: 30,
    damage: 10,
    speed: 120,
    attackRange: 100,
    targetBehavior: 'generators',
    canFly: true,
    canPhase: false,
    isBoss: false,
    lootTable: [{ type: 'circuits', amount: 1 }],
  },
  walker: {
    name: 'Walker',
    faction: 'machines',
    hp: 80,
    damage: 20,
    speed: 70,
    attackRange: 80,
    targetBehavior: 'nearest',
    canFly: false,
    canPhase: false,
    isBoss: false,
    lootTable: [{ type: 'iron_ingot', amount: 2 }, { type: 'circuits', amount: 1 }],
  },
  tank: {
    name: 'Tank',
    faction: 'machines',
    hp: 400,
    damage: 40,
    speed: 30,
    attackRange: 120,
    targetBehavior: 'core',
    canFly: false,
    canPhase: false,
    isBoss: false,
    lootTable: [{ type: 'steel', amount: 3 }, { type: 'circuits', amount: 2 }],
  },
  overseer: {
    name: 'Overseer',
    faction: 'machines',
    hp: 800,
    damage: 30,
    speed: 50,
    attackRange: 200,
    targetBehavior: 'smart',
    canFly: true,
    canPhase: false,
    isBoss: true,
    lootTable: [{ type: 'steel', amount: 10 }, { type: 'circuits', amount: 10 }, { type: 'dark_matter', amount: 3 }],
  },
  // Void
  wraith: {
    name: 'Wraith',
    faction: 'void',
    hp: 60,
    damage: 25,
    speed: 90,
    attackRange: 30,
    targetBehavior: 'nearest',
    canFly: false,
    canPhase: true,
    isBoss: false,
    lootTable: [{ type: 'dark_matter', amount: 1 }],
  },
  corruptor: {
    name: 'Corruptor',
    faction: 'void',
    hp: 150,
    damage: 15,
    speed: 50,
    attackRange: 100,
    targetBehavior: 'turrets',
    canFly: false,
    canPhase: false,
    isBoss: false,
    lootTable: [{ type: 'dark_matter', amount: 2 }],
  },
  void_lord: {
    name: 'Void Lord',
    faction: 'void',
    hp: 2000,
    damage: 80,
    speed: 40,
    attackRange: 150,
    targetBehavior: 'smart',
    canFly: true,
    canPhase: true,
    isBoss: true,
    lootTable: [{ type: 'dark_matter', amount: 15 }, { type: 'void_essence', amount: 5 }],
  },
};
