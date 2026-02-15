import {
  GameState,
  Building,
  Enemy,
  Projectile,
  TILE_SIZE,
  BUILDING_DEFINITIONS,
  TileType,
} from './types';

// ============================================================================
// COLORS
// ============================================================================

const COLORS = {
  // Tiles
  grass: '#4a7c3f',
  dirt: '#8b7355',
  stone_floor: '#888888',
  water: '#4a90b8',
  iron_deposit: '#8b6914',
  copper_deposit: '#cd7f32',
  coal_deposit: '#2a2a2a',
  stone_deposit: '#696969',
  void: '#1a1a2e',

  // Buildings
  core: '#ffd700',
  extractor: '#a0522d',
  production: '#708090',
  logistics: '#4682b4',
  defense: '#dc143c',
  power: '#ff8c00',
  utility: '#9370db',
  wall: '#555555',

  // Player
  player: '#00ff00',
  playerDead: '#666666',

  // Enemies
  hive: '#8b0000',
  machines: '#4169e1',
  void_faction: '#9400d3',

  // Projectiles
  playerProjectile: '#ffff00',
  turretProjectile: '#ff6600',
  enemyProjectile: '#ff0000',

  // UI
  healthBar: '#00ff00',
  healthBarBg: '#333333',
  energyBar: '#00bfff',
  powerRadius: 'rgba(255, 200, 0, 0.1)',
  buildableArea: 'rgba(0, 255, 0, 0.05)',
  invalidPlacement: 'rgba(255, 0, 0, 0.3)',
  validPlacement: 'rgba(0, 255, 0, 0.3)',
};

// ============================================================================
// MAIN RENDER FUNCTION
// ============================================================================

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Clear
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Save context and apply camera transform
  ctx.save();
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.scale(state.camera.zoom, state.camera.zoom);
  ctx.translate(-state.camera.x, -state.camera.y);

  // Calculate visible bounds
  const viewLeft = state.camera.x - canvasWidth / 2 / state.camera.zoom;
  const viewRight = state.camera.x + canvasWidth / 2 / state.camera.zoom;
  const viewTop = state.camera.y - canvasHeight / 2 / state.camera.zoom;
  const viewBottom = state.camera.y + canvasHeight / 2 / state.camera.zoom;

  // Render layers
  renderTiles(ctx, state, viewLeft, viewRight, viewTop, viewBottom);
  renderPowerRadii(ctx, state);
  renderBuildings(ctx, state);
  renderConveyorItems(ctx, state);
  renderEnemies(ctx, state);
  renderPlayer(ctx, state);
  renderProjectiles(ctx, state);
  renderBuildingPlacement(ctx, state, canvasWidth, canvasHeight);

  ctx.restore();

  // Render UI (not affected by camera)
  renderUI(ctx, state, canvasWidth, canvasHeight);
}

// ============================================================================
// TILES
// ============================================================================

function renderTiles(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  viewLeft: number,
  viewRight: number,
  viewTop: number,
  viewBottom: number
): void {
  const startX = Math.max(0, Math.floor(viewLeft / TILE_SIZE));
  const endX = Math.min(state.mapWidth, Math.ceil(viewRight / TILE_SIZE));
  const startY = Math.max(0, Math.floor(viewTop / TILE_SIZE));
  const endY = Math.min(state.mapHeight, Math.ceil(viewBottom / TILE_SIZE));

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = state.tiles[y]?.[x];
      if (!tile) continue;

      const worldX = x * TILE_SIZE;
      const worldY = y * TILE_SIZE;

      // Base tile color
      ctx.fillStyle = getTileColor(tile.type);
      ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

      // Buildable area indicator
      if (tile.buildable) {
        ctx.fillStyle = COLORS.buildableArea;
        ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
      }

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.strokeRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

      // Resource deposit indicator
      if (tile.type.includes('deposit')) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.arc(worldX + TILE_SIZE / 2, worldY + TILE_SIZE / 2, TILE_SIZE / 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function getTileColor(type: TileType): string {
  return COLORS[type] || COLORS.grass;
}

// ============================================================================
// POWER RADII
// ============================================================================

function renderPowerRadii(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const building of state.buildings.values()) {
    if (building.type === 'coal_generator' || building.type === 'steam_generator' || building.type === 'fusion_reactor') {
      const generator = building as any;
      if (generator.fuelStored <= 0 && building.type !== 'fusion_reactor') continue;

      const centerX = (building.gridX + building.width / 2) * TILE_SIZE;
      const centerY = (building.gridY + building.height / 2) * TILE_SIZE;
      const radius = (building.type === 'coal_generator' ? 5 : building.type === 'steam_generator' ? 8 : 15) * TILE_SIZE;

      ctx.fillStyle = COLORS.powerRadius;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 200, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

// ============================================================================
// BUILDINGS
// ============================================================================

function renderBuildings(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const building of state.buildings.values()) {
    renderBuilding(ctx, building, state);
  }
}

function renderBuilding(ctx: CanvasRenderingContext2D, building: Building, state: GameState): void {
  const x = building.gridX * TILE_SIZE;
  const y = building.gridY * TILE_SIZE;
  const w = building.width * TILE_SIZE;
  const h = building.height * TILE_SIZE;

  // Building body
  ctx.fillStyle = getBuildingColor(building.type);
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

  // Powered indicator
  if (BUILDING_DEFINITIONS[building.type].powerRequired) {
    const indicatorColor = building.powered ? '#00ff00' : '#ff0000';
    ctx.fillStyle = indicatorColor;
    ctx.beginPath();
    ctx.arc(x + w - 6, y + 6, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Building type indicator
  ctx.fillStyle = 'white';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = getBuildingLabel(building.type);
  ctx.fillText(label, x + w / 2, y + h / 2);

  // Health bar (if damaged)
  if (building.hp < building.maxHp) {
    const healthPercent = building.hp / building.maxHp;
    const barWidth = w - 4;
    const barHeight = 4;
    const barX = x + 2;
    const barY = y + h - 6;

    ctx.fillStyle = COLORS.healthBarBg;
    ctx.fillRect(barX, barY, barWidth, barHeight);

    ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  }

  // Direction indicator for conveyors
  if (building.type === 'conveyor') {
    ctx.fillStyle = 'white';
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    switch (building.direction) {
      case 'up': ctx.rotate(-Math.PI / 2); break;
      case 'down': ctx.rotate(Math.PI / 2); break;
      case 'left': ctx.rotate(Math.PI); break;
      case 'right': break;
    }
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(6, 0);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function getBuildingColor(type: string): string {
  const def = BUILDING_DEFINITIONS[type as keyof typeof BUILDING_DEFINITIONS];
  if (!def) return '#666666';

  switch (def.category) {
    case 'extraction': return COLORS.extractor;
    case 'production': return COLORS.production;
    case 'logistics': return COLORS.logistics;
    case 'defense': return COLORS.defense;
    case 'power': return COLORS.power;
    case 'utility': return COLORS.utility;
    default: return '#666666';
  }
}

function getBuildingLabel(type: string): string {
  switch (type) {
    case 'core': return 'CORE';
    case 'ore_extractor': return 'EXT';
    case 'pump': return 'PMP';
    case 'solar_collector': return 'SOL';
    case 'smelter': return 'SMT';
    case 'assembler': return 'ASM';
    case 'ammo_factory': return 'AMO';
    case 'refinery': return 'REF';
    case 'conveyor': return '';
    case 'conveyor_junction': return '+';
    case 'conveyor_router': return 'R';
    case 'drone_hub': return 'DRN';
    case 'storage': return 'STO';
    case 'turret_base': return 'TUR';
    case 'wall': return '';
    case 'wall_turret': return 'WT';
    case 'coal_generator': return 'GEN';
    case 'steam_generator': return 'STM';
    case 'fusion_reactor': return 'FUS';
    case 'research_lab': return 'LAB';
    case 'repair_station': return 'REP';
    default: return '?';
  }
}

// ============================================================================
// CONVEYOR ITEMS
// ============================================================================

function renderConveyorItems(ctx: CanvasRenderingContext2D, state: GameState): void {
  // TODO: Render items on conveyors
}

// ============================================================================
// ENEMIES
// ============================================================================

function renderEnemies(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const enemy of state.enemies.values()) {
    renderEnemy(ctx, enemy);
  }
}

function renderEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy): void {
  const { position } = enemy;
  const size = enemy.isBoss ? 24 : 16;

  // Enemy body
  let color: string;
  switch (enemy.faction) {
    case 'hive': color = COLORS.hive; break;
    case 'machines': color = COLORS.machines; break;
    case 'void': color = COLORS.void_faction; break;
    default: color = '#ff0000';
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Flying indicator
  if (enemy.canFly) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size / 2 + 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Health bar
  const healthPercent = enemy.hp / enemy.maxHp;
  const barWidth = size + 4;
  const barHeight = 3;
  const barX = position.x - barWidth / 2;
  const barY = position.y - size / 2 - 6;

  ctx.fillStyle = COLORS.healthBarBg;
  ctx.fillRect(barX, barY, barWidth, barHeight);

  ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' : healthPercent > 0.25 ? '#ffff00' : '#ff0000';
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
}

// ============================================================================
// PLAYER
// ============================================================================

function renderPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { player } = state;
  const { position } = player;
  const size = 20;

  if (player.isDead) {
    // Dead player indicator
    ctx.fillStyle = COLORS.playerDead;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'white';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('X', position.x, position.y);
    return;
  }

  // Invincibility glow
  if (player.invincible) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(position.x, position.y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Player body
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Aim direction
  const angle = Math.atan2(
    state.input.mouseWorldY - position.y,
    state.input.mouseWorldX - position.x
  );

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(position.x, position.y);
  ctx.lineTo(
    position.x + Math.cos(angle) * (size / 2 + 8),
    position.y + Math.sin(angle) * (size / 2 + 8)
  );
  ctx.stroke();

  // Commander mode indicator
  if (player.commanderMode) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ============================================================================
// PROJECTILES
// ============================================================================

function renderProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const proj of state.projectiles) {
    let color: string;
    switch (proj.owner) {
      case 'player': color = COLORS.playerProjectile; break;
      case 'turret': color = COLORS.turretProjectile; break;
      case 'enemy': color = COLORS.enemyProjectile; break;
      default: color = '#ffffff';
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(proj.position.x, proj.position.y, proj.explosive ? 6 : 4, 0, Math.PI * 2);
    ctx.fill();

    // Trail
    const trailLength = 10;
    const angle = Math.atan2(proj.velocity.y, proj.velocity.x);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(proj.position.x, proj.position.y);
    ctx.lineTo(
      proj.position.x - Math.cos(angle) * trailLength,
      proj.position.y - Math.sin(angle) * trailLength
    );
    ctx.stroke();
  }
}

// ============================================================================
// BUILDING PLACEMENT PREVIEW
// ============================================================================

function renderBuildingPlacement(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  if (!state.selectedBuilding || !state.hoveredTile) return;

  const def = BUILDING_DEFINITIONS[state.selectedBuilding];
  if (!def) return;

  const { gridX, gridY } = state.hoveredTile;
  const x = gridX * TILE_SIZE;
  const y = gridY * TILE_SIZE;
  const w = def.width * TILE_SIZE;
  const h = def.height * TILE_SIZE;

  // Check if placement is valid
  let canPlace = true;

  // Check bounds
  if (gridX < 0 || gridY < 0 || gridX + def.width > state.mapWidth || gridY + def.height > state.mapHeight) {
    canPlace = false;
  }

  // Check tiles and existing buildings
  if (canPlace) {
    for (let cy = gridY; cy < gridY + def.height; cy++) {
      for (let cx = gridX; cx < gridX + def.width; cx++) {
        const tile = state.tiles[cy]?.[cx];
        if (!tile || !tile.buildable) {
          canPlace = false;
          break;
        }

        for (const building of state.buildings.values()) {
          if (
            cx >= building.gridX &&
            cx < building.gridX + building.width &&
            cy >= building.gridY &&
            cy < building.gridY + building.height
          ) {
            canPlace = false;
            break;
          }
        }
      }
      if (!canPlace) break;
    }
  }

  // Check resources
  if (canPlace) {
    for (const cost of def.cost) {
      if ((state.resources[cost.type] || 0) < cost.amount) {
        canPlace = false;
        break;
      }
    }
  }

  // Draw preview
  ctx.fillStyle = canPlace ? COLORS.validPlacement : COLORS.invalidPlacement;
  ctx.fillRect(x, y, w, h);

  ctx.strokeStyle = canPlace ? '#00ff00' : '#ff0000';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Building label
  ctx.fillStyle = 'white';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(getBuildingLabel(state.selectedBuilding), x + w / 2, y + h / 2);
}

// ============================================================================
// UI
// ============================================================================

function renderUI(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Player HUD
  renderPlayerHUD(ctx, state, canvasWidth, canvasHeight);

  // Resources
  renderResources(ctx, state);

  // Wave info
  renderWaveInfo(ctx, state, canvasWidth);

  // Build menu
  if (state.showBuildMenu) {
    renderBuildMenu(ctx, state, canvasWidth, canvasHeight);
  }

  // Controls hint
  renderControlsHint(ctx, canvasWidth, canvasHeight);
}

function renderPlayerHUD(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  const { player } = state;
  const hudX = 10;
  const hudY = canvasHeight - 80;

  // Health bar
  ctx.fillStyle = '#333333';
  ctx.fillRect(hudX, hudY, 200, 20);

  ctx.fillStyle = player.hp > player.maxHp * 0.5 ? '#00ff00' : player.hp > player.maxHp * 0.25 ? '#ffff00' : '#ff0000';
  ctx.fillRect(hudX, hudY, 200 * (player.hp / player.maxHp), 20);

  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(hudX, hudY, 200, 20);

  ctx.fillStyle = 'white';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HP: ${Math.floor(player.hp)}/${player.maxHp}`, hudX + 100, hudY + 14);

  // Energy bar
  ctx.fillStyle = '#333333';
  ctx.fillRect(hudX, hudY + 25, 200, 15);

  ctx.fillStyle = '#00bfff';
  ctx.fillRect(hudX, hudY + 25, 200 * (player.energy / player.maxEnergy), 15);

  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(hudX, hudY + 25, 200, 15);

  ctx.fillStyle = 'white';
  ctx.font = '10px monospace';
  ctx.fillText(`Energy: ${Math.floor(player.energy)}`, hudX + 100, hudY + 36);

  // Weapon
  ctx.textAlign = 'left';
  ctx.fillText(`Weapon: ${player.currentWeapon}`, hudX, hudY + 58);

  // Abilities
  let abilityX = hudX + 220;
  for (const ability of player.abilities) {
    const abilityState = player.abilityStates[ability];
    const ready = abilityState.cooldownRemaining <= 0 && !abilityState.active;

    ctx.fillStyle = abilityState.active ? '#00ff00' : ready ? '#4444ff' : '#444444';
    ctx.fillRect(abilityX, hudY, 40, 40);

    ctx.strokeStyle = ready ? '#ffffff' : '#666666';
    ctx.strokeRect(abilityX, hudY, 40, 40);

    ctx.fillStyle = 'white';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ability.slice(0, 4).toUpperCase(), abilityX + 20, hudY + 15);

    if (abilityState.cooldownRemaining > 0) {
      ctx.fillText(`${Math.ceil(abilityState.cooldownRemaining)}s`, abilityX + 20, hudY + 30);
    }

    abilityX += 45;
  }

  // Respawn timer
  if (player.isDead) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(canvasWidth / 2 - 100, canvasHeight / 2 - 30, 200, 60);

    ctx.fillStyle = '#ff0000';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DEAD', canvasWidth / 2, canvasHeight / 2 - 5);

    ctx.fillStyle = 'white';
    ctx.font = '14px monospace';
    ctx.fillText(`Respawn in ${Math.ceil(player.respawnTimer)}s`, canvasWidth / 2, canvasHeight / 2 + 20);
  }
}

function renderResources(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, 10, 180, 200);

  ctx.fillStyle = 'white';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';

  const resources = [
    { key: 'iron_ore', label: 'Iron Ore' },
    { key: 'copper_ore', label: 'Copper Ore' },
    { key: 'coal', label: 'Coal' },
    { key: 'stone', label: 'Stone' },
    { key: 'iron_ingot', label: 'Iron Ingot' },
    { key: 'copper_wire', label: 'Copper Wire' },
    { key: 'steel', label: 'Steel' },
    { key: 'circuits', label: 'Circuits' },
    { key: 'biomass', label: 'Biomass' },
    { key: 'crystal_shards', label: 'Crystals' },
    { key: 'dark_matter', label: 'Dark Matter' },
  ];

  let y = 28;
  for (const { key, label } of resources) {
    const amount = state.resources[key as keyof typeof state.resources] || 0;
    if (amount > 0 || ['iron_ore', 'copper_ore', 'coal', 'stone'].includes(key)) {
      ctx.fillText(`${label}: ${amount}`, 20, y);
      y += 16;
    }
  }
}

function renderWaveInfo(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(canvasWidth - 200, 10, 190, 60);

  ctx.fillStyle = 'white';
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';

  ctx.fillText(`Waves Completed: ${state.wavesCompleted}`, canvasWidth - 190, 30);

  if (state.activeWave) {
    ctx.fillText(`Enemies: ${state.enemies.size}/${state.activeWave.totalEnemies}`, canvasWidth - 190, 50);
  } else {
    ctx.fillStyle = '#00ff00';
    ctx.fillText('Press W to summon wave', canvasWidth - 190, 50);
  }
}

function renderBuildMenu(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number
): void {
  const menuWidth = 300;
  const menuHeight = 400;
  const menuX = canvasWidth - menuWidth - 10;
  const menuY = 80;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
  ctx.fillRect(menuX, menuY, menuWidth, menuHeight);

  ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(menuX, menuY, menuWidth, menuHeight);

  ctx.fillStyle = 'white';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BUILD MENU (Tab to close)', menuX + menuWidth / 2, menuY + 20);

  let y = menuY + 50;
  ctx.textAlign = 'left';
  ctx.font = '11px monospace';

  for (const buildingType of state.unlockedBuildings) {
    const def = BUILDING_DEFINITIONS[buildingType];
    if (!def) continue;

    const isSelected = state.selectedBuilding === buildingType;
    ctx.fillStyle = isSelected ? '#00ff00' : '#ffffff';
    ctx.fillText(`${def.name}`, menuX + 10, y);

    // Cost
    ctx.fillStyle = '#888888';
    const costs = def.cost.map(c => `${c.amount} ${c.type.replace('_', ' ')}`).join(', ');
    ctx.fillText(costs || 'Free', menuX + 10, y + 12);

    y += 30;
    if (y > menuY + menuHeight - 20) break;
  }
}

function renderControlsHint(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(canvasWidth - 200, canvasHeight - 100, 190, 90);

  ctx.fillStyle = '#888888';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';

  const controls = [
    'WASD - Move',
    'Mouse - Aim/Shoot',
    'Tab - Build Menu',
    'Space - Dash',
    'Q - Commander Mode',
  ];

  let y = canvasHeight - 85;
  for (const control of controls) {
    ctx.fillText(control, canvasWidth - 190, y);
    y += 15;
  }
}
