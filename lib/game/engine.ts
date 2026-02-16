import {
  GameState,
  Building,
  Enemy,
  Player,
  Projectile,
  Tile,
  TileType,
  BuildingType,
  ResourceType,
  Vector2,
  GridPosition,
  TILE_SIZE,
  TICKS_PER_SECOND,
  BUILDING_DEFINITIONS,
  WEAPON_DEFINITIONS,
  ENEMY_DEFINITIONS,
  ResourceStack,
  Direction,
  WaveConfig,
  WaveModifier,
} from './types';

// ============================================================================
// INITIALIZATION
// ============================================================================

export function createInitialState(): GameState {
  const mapWidth = 128;
  const mapHeight = 128;
  const tiles = generateMap(mapWidth, mapHeight);

  const state: GameState = {
    tick: 0,
    paused: false,
    gameSpeed: 1,

    mapWidth,
    mapHeight,
    tiles,
    buildings: new Map(),

    resources: {
      iron_ore: 500,
      copper_ore: 300,
      coal: 400,
      stone: 1000,
      water: 0,
      iron_ingot: 200,
      copper_ingot: 100,
      copper_wire: 50,
      silicon: 0,
      steel: 0,
      circuits: 0,
      glass: 0,
      biomass: 0,
      crystal_shards: 0,
      dark_matter: 0,
      void_essence: 0,
    },

    player: createPlayer(mapWidth * TILE_SIZE / 2, mapHeight * TILE_SIZE / 2),

    enemies: new Map(),
    activeWave: null,
    wavesCompleted: 0,

    projectiles: [],

    completedResearch: new Set(),
    currentResearch: null,

    prestige: {
      points: 0,
      totalEarned: 0,
      upgrades: {},
    },

    unlockedBuildings: new Set(['ore_extractor', 'smelter', 'conveyor', 'storage', 'wall', 'coal_generator']),
    unlockedWeapons: new Set(['basic_rifle']),
    unlockedAbilities: new Set(['dash']),

    baseRadius: 10,

    camera: {
      x: mapWidth * TILE_SIZE / 2,
      y: mapHeight * TILE_SIZE / 2,
      zoom: 1,
    },

    input: {
      keys: new Set(),
      mouseX: 0,
      mouseY: 0,
      mouseWorldX: 0,
      mouseWorldY: 0,
      mouseDown: false,
      rightMouseDown: false,
    },

    selectedBuilding: null,
    placementDirection: 'right',
    hoveredTile: null,
    showBuildMenu: false,
    showWaveMenu: false,
    showResearchMenu: false,
  };

  // Place core at center
  const coreX = Math.floor(mapWidth / 2) - 1;
  const coreY = Math.floor(mapHeight / 2) - 1;
  placeBuilding(state, 'core', coreX, coreY, 'up');

  return state;
}

function generateMap(width: number, height: number): Tile[][] {
  const tiles: Tile[][] = [];
  const centerX = Math.floor(width / 2);
  const centerY = Math.floor(height / 2);
  const safeZoneRadius = 36; // 4x larger safe zone

  // Initialize all tiles as grass
  for (let y = 0; y < height; y++) {
    tiles[y] = [];
    for (let x = 0; x < width; x++) {
      const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      tiles[y][x] = {
        type: 'grass',
        buildable: distFromCenter <= 50,
        resourceYield: undefined,
      };
    }
  }

  // Generate resource veins
  const oreMinDist = 8; // Not too close to core
  const oreMaxDist = safeZoneRadius - 2; // Within powered area with margin
  const oreTypes: TileType[] = ['iron_deposit', 'copper_deposit', 'coal_deposit', 'stone_deposit'];
  const veinCounts = [12, 8, 6, 5]; // More iron, less stone

  for (let oreIndex = 0; oreIndex < oreTypes.length; oreIndex++) {
    const oreType = oreTypes[oreIndex];
    const numVeins = veinCounts[oreIndex];

    for (let v = 0; v < numVeins; v++) {
      // Find a valid vein center
      let veinX: number, veinY: number, dist: number;
      let attempts = 0;
      do {
        const angle = Math.random() * Math.PI * 2;
        const radius = oreMinDist + Math.random() * (oreMaxDist - oreMinDist);
        veinX = Math.floor(centerX + Math.cos(angle) * radius);
        veinY = Math.floor(centerY + Math.sin(angle) * radius);
        dist = Math.sqrt((veinX - centerX) ** 2 + (veinY - centerY) ** 2);
        attempts++;
      } while ((dist < oreMinDist || dist > oreMaxDist || veinX < 2 || veinX >= width - 2 || veinY < 2 || veinY >= height - 2) && attempts < 50);

      if (attempts >= 50) continue;

      // Create vein cluster (3-8 tiles)
      const veinSize = 3 + Math.floor(Math.random() * 6);
      const veinTiles: { x: number; y: number }[] = [{ x: veinX, y: veinY }];

      for (let i = 1; i < veinSize; i++) {
        // Grow from existing vein tile
        const parent = veinTiles[Math.floor(Math.random() * veinTiles.length)];
        const dirs = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
          { dx: 1, dy: 1 }, { dx: -1, dy: 1 },
          { dx: 1, dy: -1 }, { dx: -1, dy: -1 },
        ];
        const dir = dirs[Math.floor(Math.random() * dirs.length)];
        const newX = parent.x + dir.dx;
        const newY = parent.y + dir.dy;

        // Check if valid
        const newDist = Math.sqrt((newX - centerX) ** 2 + (newY - centerY) ** 2);
        if (newX >= 0 && newX < width && newY >= 0 && newY < height &&
            newDist >= oreMinDist && newDist <= oreMaxDist &&
            !veinTiles.some(t => t.x === newX && t.y === newY)) {
          veinTiles.push({ x: newX, y: newY });
        }
      }

      // Place the vein tiles
      for (const tile of veinTiles) {
        if (tiles[tile.y][tile.x].type === 'grass') {
          tiles[tile.y][tile.x].type = oreType;
          tiles[tile.y][tile.x].resourceYield = 1;
        }
      }
    }
  }

  // Water patches outside safe zone
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (Math.random() < 0.015 && distFromCenter > safeZoneRadius && distFromCenter <= 55) {
        tiles[y][x].type = 'water';
      }
    }
  }

  return tiles;
}

function createPlayer(x: number, y: number): Player {
  return {
    position: { x, y },
    velocity: { x: 0, y: 0 },
    hp: 100,
    maxHp: 100,
    energy: 100,
    maxEnergy: 100,
    currentWeapon: 'basic_rifle',
    weapons: ['basic_rifle'],
    abilities: ['dash'],
    abilityStates: {
      dash: { cooldownRemaining: 0, active: false, activeRemaining: 0 },
      shield: { cooldownRemaining: 0, active: false, activeRemaining: 0 },
      overdrive: { cooldownRemaining: 0, active: false, activeRemaining: 0 },
      emp: { cooldownRemaining: 0, active: false, activeRemaining: 0 },
      turret_boost: { cooldownRemaining: 0, active: false, activeRemaining: 0 },
    },
    isDead: false,
    respawnTimer: 0,
    invincible: false,
    invincibleTimer: 0,
    damageMultiplier: 1,
    speedMultiplier: 1,
    commanderMode: false,
  };
}

// ============================================================================
// GAME UPDATE
// ============================================================================

export function updateGame(state: GameState, deltaTime: number): void {
  if (state.paused) return;

  const dt = deltaTime * state.gameSpeed;
  state.tick++;

  // Update player
  updatePlayer(state, dt);

  // Update buildings
  updateBuildings(state, dt);

  // Update enemies
  updateEnemies(state, dt);

  // Update projectiles
  updateProjectiles(state, dt);

  // Update wave
  updateWave(state, dt);

  // Check collisions
  checkCollisions(state);

  // Update camera to follow player
  updateCamera(state);
}

// ============================================================================
// PLAYER
// ============================================================================

function updatePlayer(state: GameState, dt: number): void {
  const { player, input } = state;

  if (player.isDead) {
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      respawnPlayer(state);
    }
    return;
  }

  // Invincibility timer
  if (player.invincible) {
    player.invincibleTimer -= dt;
    if (player.invincibleTimer <= 0) {
      player.invincible = false;
    }
  }

  // Ability cooldowns
  for (const ability of player.abilities) {
    const abilityState = player.abilityStates[ability];
    if (abilityState.cooldownRemaining > 0) {
      abilityState.cooldownRemaining -= dt;
    }
    if (abilityState.active) {
      abilityState.activeRemaining -= dt;
      if (abilityState.activeRemaining <= 0) {
        abilityState.active = false;
        deactivateAbility(state, ability);
      }
    }
  }

  // Energy regeneration
  player.energy = Math.min(player.maxEnergy, player.energy + 10 * dt);

  // Movement
  const speed = 200 * player.speedMultiplier;
  let dx = 0;
  let dy = 0;

  if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) dy -= 1;
  if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) dy += 1;
  if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) dx -= 1;
  if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) dx += 1;

  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
  }

  player.velocity.x = dx * speed;
  player.velocity.y = dy * speed;

  player.position.x += player.velocity.x * dt;
  player.position.y += player.velocity.y * dt;

  // Clamp to map bounds
  player.position.x = Math.max(TILE_SIZE, Math.min(state.mapWidth * TILE_SIZE - TILE_SIZE, player.position.x));
  player.position.y = Math.max(TILE_SIZE, Math.min(state.mapHeight * TILE_SIZE - TILE_SIZE, player.position.y));

  // Shooting
  if (input.mouseDown && !player.commanderMode) {
    tryShoot(state);
  }
}

let lastShotTime = 0;

function tryShoot(state: GameState): void {
  const { player, input } = state;
  const weapon = WEAPON_DEFINITIONS[player.currentWeapon];
  const now = performance.now();

  if (now - lastShotTime < 1000 / weapon.fireRate) return;
  lastShotTime = now;

  const angle = Math.atan2(
    input.mouseWorldY - player.position.y,
    input.mouseWorldX - player.position.x
  );

  for (let i = 0; i < weapon.projectileCount; i++) {
    const spreadAngle = angle + (Math.random() - 0.5) * weapon.spread * (Math.PI / 180);

    const projectile: Projectile = {
      id: `proj_${state.tick}_${i}`,
      position: { x: player.position.x, y: player.position.y },
      velocity: {
        x: Math.cos(spreadAngle) * weapon.projectileSpeed,
        y: Math.sin(spreadAngle) * weapon.projectileSpeed,
      },
      damage: weapon.damage * player.damageMultiplier,
      owner: 'player',
      piercing: weapon.piercing,
      explosive: weapon.explosive,
      explosionRadius: weapon.explosionRadius,
      hitEnemies: new Set(),
      lifetime: weapon.range / weapon.projectileSpeed,
    };

    state.projectiles.push(projectile);
  }
}

function respawnPlayer(state: GameState): void {
  const { player } = state;

  // Find core position
  let corePos = { x: state.mapWidth * TILE_SIZE / 2, y: state.mapHeight * TILE_SIZE / 2 };
  for (const building of state.buildings.values()) {
    if (building.type === 'core') {
      corePos = {
        x: (building.gridX + building.width / 2) * TILE_SIZE,
        y: (building.gridY + building.height / 2) * TILE_SIZE,
      };
      break;
    }
  }

  player.position = corePos;
  player.hp = player.maxHp;
  player.energy = player.maxEnergy;
  player.isDead = false;
  player.invincible = true;
  player.invincibleTimer = 2; // 2 seconds of invincibility
}

function deactivateAbility(state: GameState, ability: string): void {
  const { player } = state;

  switch (ability) {
    case 'shield':
      player.invincible = false;
      break;
    case 'overdrive':
      player.damageMultiplier /= 1.5;
      player.speedMultiplier /= 1.5;
      break;
  }
}

export function activateAbility(state: GameState, ability: string): void {
  const { player } = state;
  const abilityState = player.abilityStates[ability as keyof typeof player.abilityStates];

  if (!abilityState || abilityState.cooldownRemaining > 0 || abilityState.active) return;

  switch (ability) {
    case 'dash':
      const dashDistance = 100;
      // Dash in movement direction if moving, otherwise toward mouse
      let dashAngle: number;
      const velMag = Math.sqrt(player.velocity.x * player.velocity.x + player.velocity.y * player.velocity.y);
      if (velMag > 10) {
        dashAngle = Math.atan2(player.velocity.y, player.velocity.x);
      } else {
        // Dash toward mouse cursor
        dashAngle = Math.atan2(
          state.input.mouseWorldY - player.position.y,
          state.input.mouseWorldX - player.position.x
        );
      }
      player.position.x += Math.cos(dashAngle) * dashDistance;
      player.position.y += Math.sin(dashAngle) * dashDistance;
      player.invincible = true;
      player.invincibleTimer = 0.2; // Brief invincibility during dash
      abilityState.cooldownRemaining = 1;
      break;
    case 'shield':
      player.invincible = true;
      abilityState.active = true;
      abilityState.activeRemaining = 3;
      abilityState.cooldownRemaining = 10;
      break;
    case 'overdrive':
      player.damageMultiplier *= 1.5;
      player.speedMultiplier *= 1.5;
      abilityState.active = true;
      abilityState.activeRemaining = 5;
      abilityState.cooldownRemaining = 15;
      break;
    case 'emp':
      // Stun nearby enemies
      for (const enemy of state.enemies.values()) {
        const dist = distance(player.position, enemy.position);
        if (dist < 200) {
          enemy.currentCooldown = 3; // Stun for 3 seconds
        }
      }
      abilityState.cooldownRemaining = 20;
      break;
    case 'turret_boost':
      // TODO: Implement turret boost
      abilityState.active = true;
      abilityState.activeRemaining = 10;
      abilityState.cooldownRemaining = 30;
      break;
  }
}

// ============================================================================
// BUILDINGS
// ============================================================================

function updateBuildings(state: GameState, dt: number): void {
  // First pass: update power status
  updatePowerStatus(state);

  // Second pass: update building logic
  for (const building of state.buildings.values()) {
    if (!building.powered && BUILDING_DEFINITIONS[building.type].powerRequired) {
      continue; // Skip unpowered buildings that need power
    }

    switch (building.type) {
      case 'ore_extractor':
        updateExtractor(state, building, dt);
        break;
      case 'smelter':
      case 'assembler':
      case 'ammo_factory':
      case 'refinery':
        updateProduction(state, building, dt);
        break;
      case 'coal_generator':
      case 'steam_generator':
        updateGenerator(state, building, dt);
        break;
      case 'turret_base':
      case 'wall_turret':
        updateTurret(state, building, dt);
        break;
      case 'repair_station':
        updateRepairStation(state, building, dt);
        break;
      case 'conveyor':
      case 'conveyor_junction':
      case 'conveyor_router':
        updateConveyor(state, building, dt);
        break;
    }
  }

  // After all buildings update, transfer items between conveyors
  transferConveyorItems(state);
}

function updatePowerStatus(state: GameState): void {
  // Reset all power status
  for (const building of state.buildings.values()) {
    building.powered = false;
  }

  // Find all generators and power nearby buildings
  for (const building of state.buildings.values()) {
    if (building.type === 'coal_generator' || building.type === 'steam_generator' || building.type === 'fusion_reactor') {
      const generator = building as any;
      const radius = building.type === 'coal_generator' ? 5 : building.type === 'steam_generator' ? 8 : 15;
      const centerX = building.gridX + building.width / 2;
      const centerY = building.gridY + building.height / 2;

      // Check if generator has fuel
      if (generator.fuelStored <= 0 && building.type !== 'fusion_reactor') {
        continue;
      }

      for (const other of state.buildings.values()) {
        const otherCenterX = other.gridX + other.width / 2;
        const otherCenterY = other.gridY + other.height / 2;
        const dist = Math.sqrt((centerX - otherCenterX) ** 2 + (centerY - otherCenterY) ** 2);

        if (dist <= radius) {
          other.powered = true;
        }
      }
    }
  }

  // Core is always powered AND provides power to nearby buildings
  for (const building of state.buildings.values()) {
    if (building.type === 'core') {
      building.powered = true;

      // Core powers buildings within radius 36
      const coreRadius = 36;
      const centerX = building.gridX + building.width / 2;
      const centerY = building.gridY + building.height / 2;

      for (const other of state.buildings.values()) {
        const otherCenterX = other.gridX + other.width / 2;
        const otherCenterY = other.gridY + other.height / 2;
        const dist = Math.sqrt((centerX - otherCenterX) ** 2 + (centerY - otherCenterY) ** 2);

        if (dist <= coreRadius) {
          other.powered = true;
        }
      }
    }
  }
}

function updateExtractor(state: GameState, building: Building, dt: number): void {
  // Check all tiles the extractor occupies for deposits and count matching ones
  let depositTile: typeof state.tiles[0][0] | null = null;
  let depositCount = 0;
  let depositType: string | null = null;

  for (let dy = 0; dy < building.height; dy++) {
    for (let dx = 0; dx < building.width; dx++) {
      const tile = state.tiles[building.gridY + dy]?.[building.gridX + dx];
      if (tile && tile.type.includes('deposit')) {
        if (!depositTile) {
          depositTile = tile;
          depositType = tile.type;
        }
        // Count matching deposit types
        if (tile.type === depositType) {
          depositCount++;
        }
      }
    }
  }

  if (!depositTile) return;

  // Extract resources - base 4 seconds, faster with more deposits
  // 1 deposit = 4s, 2 deposits = 2s, 3 deposits = 1.33s, 4 deposits = 1s
  const baseTime = 4; // Half speed (was 2 seconds)
  const extractTime = baseTime / depositCount;

  building.craftProgress += dt;
  if (building.craftProgress >= extractTime) {
    building.craftProgress = 0;

    let resourceType: ResourceType;
    switch (depositTile.type) {
      case 'iron_deposit': resourceType = 'iron_ore'; break;
      case 'copper_deposit': resourceType = 'copper_ore'; break;
      case 'coal_deposit': resourceType = 'coal'; break;
      case 'stone_deposit': resourceType = 'stone'; break;
      default: return;
    }

    // Add to output storage or push to adjacent conveyor
    const adjacentConveyor = findAdjacentConveyor(state, building);
    if (adjacentConveyor) {
      // Push directly to conveyor
      const conveyorBldg = adjacentConveyor as any;
      if (!conveyorBldg.items) conveyorBldg.items = [];
      if (conveyorBldg.items.length < 3) { // Max 3 items per conveyor
        conveyorBldg.items.push({ resource: resourceType, progress: 0 });
      }
    } else {
      // Store locally
      const existing = building.outputStorage.find(s => s.type === resourceType);
      if (existing) {
        existing.amount += 1;
      } else {
        building.outputStorage.push({ type: resourceType, amount: 1 });
      }
    }
  }
}

function findAdjacentConveyor(state: GameState, building: Building): Building | null {
  // Check all edges of the building for conveyors
  const checkPositions: { x: number; y: number }[] = [];

  // Right edge
  for (let y = 0; y < building.height; y++) {
    checkPositions.push({ x: building.gridX + building.width, y: building.gridY + y });
  }
  // Left edge
  for (let y = 0; y < building.height; y++) {
    checkPositions.push({ x: building.gridX - 1, y: building.gridY + y });
  }
  // Bottom edge
  for (let x = 0; x < building.width; x++) {
    checkPositions.push({ x: building.gridX + x, y: building.gridY + building.height });
  }
  // Top edge
  for (let x = 0; x < building.width; x++) {
    checkPositions.push({ x: building.gridX + x, y: building.gridY - 1 });
  }

  for (const pos of checkPositions) {
    for (const other of state.buildings.values()) {
      if (
        (other.type === 'conveyor' || other.type === 'conveyor_junction' || other.type === 'conveyor_router') &&
        other.gridX === pos.x && other.gridY === pos.y
      ) {
        return other;
      }
    }
  }
  return null;
}

function updateConveyor(state: GameState, building: Building, dt: number): void {
  const conveyor = building as any;
  if (!conveyor.items) conveyor.items = [];

  // Move items along the conveyor (3x speed)
  const speed = 1.5; // Items move at 1.5 progress per second
  for (const item of conveyor.items) {
    item.progress += speed * dt;
  }
}

function transferConveyorItems(state: GameState): void {
  // Transfer items that have reached the end of conveyors
  for (const building of state.buildings.values()) {
    if (building.type !== 'conveyor' && building.type !== 'conveyor_junction' && building.type !== 'conveyor_router') {
      continue;
    }

    const conveyor = building as any;
    if (!conveyor.items) continue;

    // Find items that are ready to transfer (progress >= 1)
    const readyItems = conveyor.items.filter((item: any) => item.progress >= 1);

    for (const item of readyItems) {
      // Find next building in direction
      const dir = building.direction || 'right';
      let nextX = building.gridX;
      let nextY = building.gridY;

      switch (dir) {
        case 'right': nextX += 1; break;
        case 'left': nextX -= 1; break;
        case 'down': nextY += 1; break;
        case 'up': nextY -= 1; break;
      }

      // Find building at next position
      let nextBuilding: Building | null = null;
      for (const other of state.buildings.values()) {
        if (other.gridX === nextX && other.gridY === nextY) {
          nextBuilding = other;
          break;
        }
        // Also check if it's a multi-tile building
        if (
          nextX >= other.gridX && nextX < other.gridX + other.width &&
          nextY >= other.gridY && nextY < other.gridY + other.height
        ) {
          nextBuilding = other;
          break;
        }
      }

      if (nextBuilding) {
        if (nextBuilding.type === 'conveyor' || nextBuilding.type === 'conveyor_junction' || nextBuilding.type === 'conveyor_router') {
          // Transfer to next conveyor
          const nextConveyor = nextBuilding as any;
          if (!nextConveyor.items) nextConveyor.items = [];
          if (nextConveyor.items.length < 3) {
            nextConveyor.items.push({ resource: item.resource, progress: 0 });
            conveyor.items = conveyor.items.filter((i: any) => i !== item);
          }
        } else if (nextBuilding.type === 'storage' || nextBuilding.type === 'core') {
          // Deposit into storage or core (add to global resources)
          const resType = item.resource as ResourceType;
          state.resources[resType] = (state.resources[resType] || 0) + 1;
          conveyor.items = conveyor.items.filter((i: any) => i !== item);
        } else if (nextBuilding.type === 'smelter' || nextBuilding.type === 'assembler') {
          // Add to input storage
          const existing = nextBuilding.inputStorage.find(s => s.type === item.resource);
          if (existing) {
            existing.amount += 1;
          } else {
            nextBuilding.inputStorage.push({ type: item.resource, amount: 1 });
          }
          conveyor.items = conveyor.items.filter((i: any) => i !== item);
        }
      } else {
        // No next building, item falls off - add to global storage
        const resType = item.resource as ResourceType;
        state.resources[resType] = (state.resources[resType] || 0) + 1;
        conveyor.items = conveyor.items.filter((i: any) => i !== item);
      }
    }
  }
}

function updateProduction(state: GameState, building: Building, dt: number): void {
  // TODO: Implement production logic with recipes
}

function updateGenerator(state: GameState, building: Building, dt: number): void {
  const generator = building as any;

  // Consume fuel
  if (generator.fuelStored > 0) {
    generator.fuelStored -= dt * 0.1; // Consume 0.1 fuel per second
  }

  // Try to grab fuel from storage
  if (generator.fuelStored < 10 && state.resources.coal > 0) {
    state.resources.coal--;
    generator.fuelStored += 5;
  }
}

function updateTurret(state: GameState, building: Building, dt: number): void {
  const turret = building as any;

  // Cooldown
  if (turret.cooldown > 0) {
    turret.cooldown -= dt;
    return;
  }

  // Find target
  let target: Enemy | null = null;
  let minDist = Infinity;
  const turretPos = {
    x: (building.gridX + building.width / 2) * TILE_SIZE,
    y: (building.gridY + building.height / 2) * TILE_SIZE,
  };

  for (const enemy of state.enemies.values()) {
    const dist = distance(turretPos, enemy.position);
    if (dist < 200 && dist < minDist) { // 200 range
      minDist = dist;
      target = enemy;
    }
  }

  if (!target) return;

  // Fire
  const angle = Math.atan2(target.position.y - turretPos.y, target.position.x - turretPos.x);

  const projectile: Projectile = {
    id: `turret_${building.id}_${state.tick}`,
    position: { ...turretPos },
    velocity: {
      x: Math.cos(angle) * 500,
      y: Math.sin(angle) * 500,
    },
    damage: 15,
    owner: 'turret',
    piercing: false,
    explosive: false,
    explosionRadius: 0,
    hitEnemies: new Set(),
    lifetime: 1,
  };

  state.projectiles.push(projectile);
  turret.cooldown = 0.5; // Fire every 0.5 seconds
}

function updateRepairStation(state: GameState, building: Building, dt: number): void {
  // Repair nearby buildings
  const centerX = building.gridX + building.width / 2;
  const centerY = building.gridY + building.height / 2;

  for (const other of state.buildings.values()) {
    if (other.id === building.id) continue;

    const otherCenterX = other.gridX + other.width / 2;
    const otherCenterY = other.gridY + other.height / 2;
    const dist = Math.sqrt((centerX - otherCenterX) ** 2 + (centerY - otherCenterY) ** 2);

    if (dist <= 5 && other.hp < other.maxHp) {
      other.hp = Math.min(other.maxHp, other.hp + 5 * dt);
    }
  }
}

// ============================================================================
// ENEMIES
// ============================================================================

function updateEnemies(state: GameState, dt: number): void {
  for (const enemy of state.enemies.values()) {
    updateEnemy(state, enemy, dt);
  }
}

function updateEnemy(state: GameState, enemy: Enemy, dt: number): void {
  // Cooldown
  if (enemy.currentCooldown > 0) {
    enemy.currentCooldown -= dt;
    return; // Stunned
  }

  // Find target
  const target = findEnemyTarget(state, enemy);
  if (!target) return;

  // Move towards target
  const dx = target.x - enemy.position.x;
  const dy = target.y - enemy.position.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > enemy.attackRange) {
    // Move
    const speed = enemy.speed * dt;
    enemy.position.x += (dx / dist) * speed;
    enemy.position.y += (dy / dist) * speed;
  } else {
    // Attack
    if (enemy.currentCooldown <= 0) {
      performEnemyAttack(state, enemy, target);
      enemy.currentCooldown = 1; // Attack cooldown
    }
  }
}

function findEnemyTarget(state: GameState, enemy: Enemy): Vector2 | null {
  switch (enemy.targetBehavior) {
    case 'nearest':
      return findNearestTarget(state, enemy);
    case 'core':
      return findCoreTarget(state);
    case 'turrets':
      return findTurretTarget(state, enemy) || findCoreTarget(state);
    case 'generators':
      return findGeneratorTarget(state, enemy) || findCoreTarget(state);
    case 'smart':
      return findSmartTarget(state, enemy);
    default:
      return findCoreTarget(state);
  }
}

function findNearestTarget(state: GameState, enemy: Enemy): Vector2 | null {
  let nearest: Vector2 | null = null;
  let minDist = Infinity;

  // Check player
  if (!state.player.isDead) {
    const dist = distance(enemy.position, state.player.position);
    if (dist < minDist) {
      minDist = dist;
      nearest = state.player.position;
    }
  }

  // Check buildings
  for (const building of state.buildings.values()) {
    const pos = {
      x: (building.gridX + building.width / 2) * TILE_SIZE,
      y: (building.gridY + building.height / 2) * TILE_SIZE,
    };
    const dist = distance(enemy.position, pos);
    if (dist < minDist) {
      minDist = dist;
      nearest = pos;
    }
  }

  return nearest;
}

function findCoreTarget(state: GameState): Vector2 | null {
  for (const building of state.buildings.values()) {
    if (building.type === 'core') {
      return {
        x: (building.gridX + building.width / 2) * TILE_SIZE,
        y: (building.gridY + building.height / 2) * TILE_SIZE,
      };
    }
  }
  return null;
}

function findTurretTarget(state: GameState, enemy: Enemy): Vector2 | null {
  let nearest: Vector2 | null = null;
  let minDist = Infinity;

  for (const building of state.buildings.values()) {
    if (building.type === 'turret_base' || building.type === 'wall_turret') {
      const pos = {
        x: (building.gridX + building.width / 2) * TILE_SIZE,
        y: (building.gridY + building.height / 2) * TILE_SIZE,
      };
      const dist = distance(enemy.position, pos);
      if (dist < minDist) {
        minDist = dist;
        nearest = pos;
      }
    }
  }

  return nearest;
}

function findGeneratorTarget(state: GameState, enemy: Enemy): Vector2 | null {
  let nearest: Vector2 | null = null;
  let minDist = Infinity;

  for (const building of state.buildings.values()) {
    if (building.type.includes('generator') || building.type === 'fusion_reactor') {
      const pos = {
        x: (building.gridX + building.width / 2) * TILE_SIZE,
        y: (building.gridY + building.height / 2) * TILE_SIZE,
      };
      const dist = distance(enemy.position, pos);
      if (dist < minDist) {
        minDist = dist;
        nearest = pos;
      }
    }
  }

  return nearest;
}

function findSmartTarget(state: GameState, enemy: Enemy): Vector2 | null {
  // Prioritize: player (if close) > turrets > generators > core
  if (!state.player.isDead && distance(enemy.position, state.player.position) < 300) {
    return state.player.position;
  }

  return findTurretTarget(state, enemy)
    || findGeneratorTarget(state, enemy)
    || findCoreTarget(state);
}

function performEnemyAttack(state: GameState, enemy: Enemy, target: Vector2): void {
  // Check if hitting player
  if (!state.player.isDead && distance(target, state.player.position) < 30) {
    if (!state.player.invincible) {
      state.player.hp -= enemy.damage;
      if (state.player.hp <= 0) {
        state.player.isDead = true;
        state.player.respawnTimer = 5; // 5 second respawn
        // TODO: Subtract respawn cost
      }
    }
    return;
  }

  // Check if hitting building
  for (const building of state.buildings.values()) {
    const buildingPos = {
      x: (building.gridX + building.width / 2) * TILE_SIZE,
      y: (building.gridY + building.height / 2) * TILE_SIZE,
    };
    if (distance(target, buildingPos) < TILE_SIZE) {
      building.hp -= enemy.damage;
      if (building.hp <= 0) {
        state.buildings.delete(building.id);
      }
      return;
    }
  }
}

// ============================================================================
// PROJECTILES
// ============================================================================

function updateProjectiles(state: GameState, dt: number): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];

    proj.position.x += proj.velocity.x * dt;
    proj.position.y += proj.velocity.y * dt;
    proj.lifetime -= dt;

    if (proj.lifetime <= 0) {
      state.projectiles.splice(i, 1);
    }
  }
}

function checkCollisions(state: GameState): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const proj = state.projectiles[i];

    if (proj.owner === 'player' || proj.owner === 'turret') {
      // Check collision with enemies
      for (const enemy of state.enemies.values()) {
        if (proj.hitEnemies.has(enemy.id)) continue;

        if (distance(proj.position, enemy.position) < 20) {
          enemy.hp -= proj.damage;
          proj.hitEnemies.add(enemy.id);

          if (enemy.hp <= 0) {
            // Drop loot
            for (const loot of enemy.lootTable) {
              state.resources[loot.type] = (state.resources[loot.type] || 0) + loot.amount;
            }
            state.enemies.delete(enemy.id);
          }

          if (proj.explosive) {
            // Explosion damage
            for (const other of state.enemies.values()) {
              if (other.id !== enemy.id && distance(proj.position, other.position) < proj.explosionRadius) {
                other.hp -= proj.damage * 0.5;
                if (other.hp <= 0) {
                  for (const loot of other.lootTable) {
                    state.resources[loot.type] = (state.resources[loot.type] || 0) + loot.amount;
                  }
                  state.enemies.delete(other.id);
                }
              }
            }
          }

          if (!proj.piercing) {
            state.projectiles.splice(i, 1);
            break;
          }
        }
      }
    } else if (proj.owner === 'enemy') {
      // Check collision with player
      if (!state.player.isDead && !state.player.invincible) {
        if (distance(proj.position, state.player.position) < 20) {
          state.player.hp -= proj.damage;
          state.projectiles.splice(i, 1);

          if (state.player.hp <= 0) {
            state.player.isDead = true;
            state.player.respawnTimer = 5;
          }
        }
      }
    }
  }
}

// ============================================================================
// WAVES
// ============================================================================

function updateWave(state: GameState, dt: number): void {
  if (!state.activeWave) return;

  const wave = state.activeWave;

  // Spawn enemies
  if (wave.enemiesRemaining > 0) {
    wave.spawnTimer -= dt;
    if (wave.spawnTimer <= 0) {
      spawnEnemy(state);
      wave.enemiesRemaining--;
      wave.spawnTimer = 0.5; // Spawn every 0.5 seconds
    }
  }

  // Check if wave complete
  if (wave.enemiesRemaining === 0 && state.enemies.size === 0) {
    completeWave(state);
  }
}

function spawnEnemy(state: GameState): void {
  if (!state.activeWave) return;

  const wave = state.activeWave;

  // Pick random enemy type from wave config
  const enemyTypes = wave.config.enemyTypes;
  const randomType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
  const def = ENEMY_DEFINITIONS[randomType.type];

  // Spawn at edge of map
  const edge = Math.floor(Math.random() * 4);
  let x: number, y: number;

  switch (edge) {
    case 0: // Top
      x = Math.random() * state.mapWidth * TILE_SIZE;
      y = TILE_SIZE;
      break;
    case 1: // Right
      x = (state.mapWidth - 1) * TILE_SIZE;
      y = Math.random() * state.mapHeight * TILE_SIZE;
      break;
    case 2: // Bottom
      x = Math.random() * state.mapWidth * TILE_SIZE;
      y = (state.mapHeight - 1) * TILE_SIZE;
      break;
    default: // Left
      x = TILE_SIZE;
      y = Math.random() * state.mapHeight * TILE_SIZE;
      break;
  }

  // Apply modifiers
  let hpMult = 1;
  let speedMult = 1;

  for (const mod of wave.modifiers) {
    if (mod === 'armored') hpMult *= 2;
    if (mod === 'fast') speedMult *= 1.5;
  }

  const enemy: Enemy = {
    id: `enemy_${state.tick}_${Math.random()}`,
    type: randomType.type,
    faction: def.faction,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    hp: def.hp * hpMult,
    maxHp: def.hp * hpMult,
    damage: def.damage,
    speed: def.speed * speedMult,
    attackRange: def.attackRange,
    attackCooldown: 1,
    currentCooldown: 0,
    targetBehavior: def.targetBehavior,
    targetId: null,
    canFly: def.canFly,
    canPhase: def.canPhase,
    isBoss: def.isBoss,
    lootTable: [...def.lootTable],
  };

  state.enemies.set(enemy.id, enemy);
}

function completeWave(state: GameState): void {
  if (!state.activeWave) return;

  const wave = state.activeWave;

  // Grant rewards
  let rewardMult = 1;
  for (const mod of wave.modifiers) {
    if (mod === 'swarm') rewardMult *= 1.25;
    if (mod === 'armored') rewardMult *= 1.3;
    if (mod === 'fast') rewardMult *= 1.2;
    if (mod === 'regenerating') rewardMult *= 1.35;
    if (mod === 'boss') rewardMult *= 2;
  }

  for (const reward of wave.config.baseReward) {
    state.resources[reward.type] = (state.resources[reward.type] || 0) + Math.floor(reward.amount * rewardMult);
  }

  state.wavesCompleted++;
  state.activeWave = null;
}

export function startWave(state: GameState, waveConfig: WaveConfig, modifiers: WaveModifier[]): void {
  // Check if can afford
  for (const cost of waveConfig.baseCost) {
    if ((state.resources[cost.type as ResourceType] || 0) < cost.amount) {
      return; // Can't afford
    }
  }

  // Deduct cost
  for (const cost of waveConfig.baseCost) {
    state.resources[cost.type as ResourceType] -= cost.amount;
  }

  // Calculate total enemies
  let totalEnemies = 0;
  for (const et of waveConfig.enemyTypes) {
    totalEnemies += et.count;
  }

  // Apply swarm modifier
  if (modifiers.includes('swarm')) {
    totalEnemies = Math.floor(totalEnemies * 1.5);
  }

  state.activeWave = {
    config: waveConfig,
    modifiers: modifiers,
    enemiesRemaining: totalEnemies,
    totalEnemies,
    spawnTimer: 0,
    completed: false,
  };
}

// ============================================================================
// BUILDING PLACEMENT
// ============================================================================

export function canPlaceBuilding(state: GameState, type: BuildingType, gridX: number, gridY: number): boolean {
  const def = BUILDING_DEFINITIONS[type];
  if (!def) return false;

  // Check bounds
  if (gridX < 0 || gridY < 0 || gridX + def.width > state.mapWidth || gridY + def.height > state.mapHeight) {
    return false;
  }

  // Check if tiles are buildable and not occupied
  for (let y = gridY; y < gridY + def.height; y++) {
    for (let x = gridX; x < gridX + def.width; x++) {
      const tile = state.tiles[y]?.[x];
      if (!tile || !tile.buildable) return false;

      // Check for existing buildings
      for (const building of state.buildings.values()) {
        if (
          x >= building.gridX &&
          x < building.gridX + building.width &&
          y >= building.gridY &&
          y < building.gridY + building.height
        ) {
          return false;
        }
      }
    }
  }

  // Check resource requirements
  for (const cost of def.cost) {
    if ((state.resources[cost.type] || 0) < cost.amount) {
      return false;
    }
  }

  // Special placement rules
  if (type === 'ore_extractor') {
    const tile = state.tiles[gridY]?.[gridX];
    if (!tile || !tile.type.includes('deposit')) {
      return false;
    }
  }

  if (type === 'pump') {
    const tile = state.tiles[gridY]?.[gridX];
    if (!tile || tile.type !== 'water') {
      return false;
    }
  }

  return true;
}

export function placeBuilding(state: GameState, type: BuildingType, gridX: number, gridY: number, direction: Direction): boolean {
  if (!canPlaceBuilding(state, type, gridX, gridY)) {
    return false;
  }

  const def = BUILDING_DEFINITIONS[type];

  // Deduct resources
  for (const cost of def.cost) {
    state.resources[cost.type] -= cost.amount;
  }

  const building: Building = {
    id: `building_${state.tick}_${Math.random()}`,
    type,
    gridX,
    gridY,
    width: def.width,
    height: def.height,
    hp: def.maxHp,
    maxHp: def.maxHp,
    direction,
    powered: false,
    inputStorage: [],
    outputStorage: [],
    craftProgress: 0,
    currentRecipe: null,
    level: 1,
  };

  // Add type-specific properties
  if (type === 'coal_generator' || type === 'steam_generator' || type === 'fusion_reactor') {
    (building as any).powerRadius = type === 'coal_generator' ? 5 : type === 'steam_generator' ? 8 : 15;
    (building as any).fuelStored = 10;
  }

  if (type === 'turret_base' || type === 'wall_turret') {
    (building as any).barrelType = 'mg';
    (building as any).modules = [];
    (building as any).targetId = null;
    (building as any).cooldown = 0;
    (building as any).ammoType = null;
    (building as any).ammoCount = 0;
  }

  state.buildings.set(building.id, building);
  return true;
}

export function removeBuilding(state: GameState, buildingId: string): void {
  const building = state.buildings.get(buildingId);
  if (!building) return;

  // Can't remove core
  if (building.type === 'core') return;

  // Refund some resources
  const def = BUILDING_DEFINITIONS[building.type];
  for (const cost of def.cost) {
    state.resources[cost.type] = (state.resources[cost.type] || 0) + Math.floor(cost.amount * 0.5);
  }

  state.buildings.delete(buildingId);
}

// ============================================================================
// CAMERA
// ============================================================================

function updateCamera(state: GameState): void {
  // Smooth follow player
  const lerpSpeed = 0.1;
  state.camera.x += (state.player.position.x - state.camera.x) * lerpSpeed;
  state.camera.y += (state.player.position.y - state.camera.y) * lerpSpeed;
}

// ============================================================================
// UTILITIES
// ============================================================================

function distance(a: Vector2, b: Vector2): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

export function worldToGrid(worldX: number, worldY: number): GridPosition {
  return {
    gridX: Math.floor(worldX / TILE_SIZE),
    gridY: Math.floor(worldY / TILE_SIZE),
  };
}

export function gridToWorld(gridX: number, gridY: number): Vector2 {
  return {
    x: gridX * TILE_SIZE + TILE_SIZE / 2,
    y: gridY * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function screenToWorld(
  screenX: number,
  screenY: number,
  camera: GameState['camera'],
  canvasWidth: number,
  canvasHeight: number
): Vector2 {
  return {
    x: (screenX - canvasWidth / 2) / camera.zoom + camera.x,
    y: (screenY - canvasHeight / 2) / camera.zoom + camera.y,
  };
}
