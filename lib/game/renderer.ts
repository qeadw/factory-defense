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
// INDUSTRIAL COLOR PALETTE
// ============================================================================

const COLORS = {
  // Tiles - Dark industrial ground
  grass: '#2a3a28',
  dirt: '#3d3428',
  stone_floor: '#4a4a4a',
  water: '#1a3040',
  iron_deposit: '#5c4a2a',
  copper_deposit: '#6b4423',
  coal_deposit: '#1a1a1a',
  stone_deposit: '#3a3a3a',
  void: '#0a0a12',

  // Buildings - Metallic industrial
  core: '#c4a000',
  extractor: '#6b5030',
  production: '#505860',
  logistics: '#3a5060',
  defense: '#8b2020',
  power: '#b06000',
  utility: '#504060',
  wall: '#3a3a3a',

  // Player - Industrial mech
  player: '#70a060',
  playerDead: '#404040',

  // Enemies
  hive: '#6b1010',
  machines: '#304080',
  void_faction: '#5a1080',

  // Projectiles
  playerProjectile: '#c0d000',
  turretProjectile: '#d06000',
  enemyProjectile: '#c02020',

  // UI
  healthBar: '#70a060',
  healthBarBg: '#1a1a1a',
  energyBar: '#4080a0',
  powerRadius: 'rgba(180, 120, 40, 0.08)',
  buildableArea: 'rgba(100, 140, 80, 0.03)',
  invalidPlacement: 'rgba(180, 40, 40, 0.25)',
  validPlacement: 'rgba(100, 140, 80, 0.25)',

  // Industrial accents
  rust: '#6b3020',
  metal: '#606870',
  metalDark: '#404850',
  metalLight: '#808890',
  grime: '#2a2820',
  warning: '#c0a020',
  steam: 'rgba(180, 180, 160, 0.3)',
  sparks: '#d09030',
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
  // Clear with dark industrial background
  ctx.fillStyle = '#0c0c10';
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

      // Industrial texture noise
      const noise = ((x * 7 + y * 13) % 17) / 17;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + noise * 0.08})`;
      ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

      // Buildable area - subtle metal plate look
      if (tile.buildable) {
        ctx.fillStyle = COLORS.buildableArea;
        ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

        // Corner rivets
        ctx.fillStyle = 'rgba(60, 60, 70, 0.4)';
        const rivetSize = 2;
        ctx.fillRect(worldX + 2, worldY + 2, rivetSize, rivetSize);
        ctx.fillRect(worldX + TILE_SIZE - 4, worldY + 2, rivetSize, rivetSize);
        ctx.fillRect(worldX + 2, worldY + TILE_SIZE - 4, rivetSize, rivetSize);
        ctx.fillRect(worldX + TILE_SIZE - 4, worldY + TILE_SIZE - 4, rivetSize, rivetSize);
      }

      // Grid lines - industrial seams
      ctx.strokeStyle = 'rgba(20, 20, 25, 0.8)';
      ctx.lineWidth = 1;
      ctx.strokeRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

      // Resource deposit indicator - ore chunks
      if (tile.type.includes('deposit')) {
        const depositColor = tile.type === 'iron_deposit' ? '#7a6040' :
                            tile.type === 'copper_deposit' ? '#8b5535' :
                            tile.type === 'coal_deposit' ? '#252525' : '#555555';

        // Multiple ore chunks
        for (let i = 0; i < 3; i++) {
          const ox = worldX + 8 + ((i * 11 + x) % 16);
          const oy = worldY + 8 + ((i * 7 + y) % 16);
          const size = 4 + (i % 2) * 2;

          ctx.fillStyle = depositColor;
          ctx.beginPath();
          ctx.moveTo(ox, oy - size/2);
          ctx.lineTo(ox + size/2, oy);
          ctx.lineTo(ox, oy + size/2);
          ctx.lineTo(ox - size/2, oy);
          ctx.closePath();
          ctx.fill();

          // Highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(ox - size/4, oy - size/2, size/2, size/4);
        }
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

  // Building shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillRect(x + 4, y + 4, w - 4, h - 4);

  // Building body - dark base
  ctx.fillStyle = COLORS.metalDark;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

  // Building top layer with color
  const buildingColor = getBuildingColor(building.type);
  ctx.fillStyle = buildingColor;
  ctx.fillRect(x + 3, y + 3, w - 6, h - 6);

  // Industrial panel lines
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  if (w > TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x + w/2, y + 4);
    ctx.lineTo(x + w/2, y + h - 4);
    ctx.stroke();
  }
  if (h > TILE_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + h/2);
    ctx.lineTo(x + w - 4, y + h/2);
    ctx.stroke();
  }

  // Top highlight edge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(x + 3, y + 3, w - 6, 2);

  // Bottom shadow edge
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.fillRect(x + 3, y + h - 5, w - 6, 2);

  // Corner bolts
  ctx.fillStyle = COLORS.metalLight;
  const boltSize = 3;
  ctx.fillRect(x + 4, y + 4, boltSize, boltSize);
  ctx.fillRect(x + w - 7, y + 4, boltSize, boltSize);
  ctx.fillRect(x + 4, y + h - 7, boltSize, boltSize);
  ctx.fillRect(x + w - 7, y + h - 7, boltSize, boltSize);

  // Powered indicator - industrial light
  if (BUILDING_DEFINITIONS[building.type].powerRequired) {
    const powered = building.powered;
    ctx.fillStyle = powered ? '#50a050' : '#802020';
    ctx.fillRect(x + w - 10, y + 4, 6, 6);
    ctx.strokeStyle = '#303030';
    ctx.strokeRect(x + w - 10, y + 4, 6, 6);

    // Glow when powered
    if (powered) {
      ctx.fillStyle = 'rgba(80, 160, 80, 0.3)';
      ctx.beginPath();
      ctx.arc(x + w - 7, y + 7, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Building type indicator - stencil style
  ctx.fillStyle = 'rgba(200, 200, 180, 0.9)';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = getBuildingLabel(building.type);
  if (label) {
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  // Health bar (if damaged) - industrial style
  if (building.hp < building.maxHp) {
    const healthPercent = building.hp / building.maxHp;
    const barWidth = w - 8;
    const barHeight = 4;
    const barX = x + 4;
    const barY = y + h - 8;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    ctx.fillStyle = healthPercent > 0.5 ? '#508050' : healthPercent > 0.25 ? '#a08030' : '#803030';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Damage rust marks
    if (healthPercent < 0.7) {
      ctx.fillStyle = COLORS.rust;
      const rustX = x + 6 + (building.id.charCodeAt(0) % 10);
      const rustY = y + 6 + (building.id.charCodeAt(1) % 8);
      ctx.fillRect(rustX, rustY, 4, 3);
    }
  }

  // Direction indicator for conveyors - industrial arrows
  if (building.type === 'conveyor') {
    ctx.fillStyle = COLORS.metalLight;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    switch (building.direction) {
      case 'up': ctx.rotate(-Math.PI / 2); break;
      case 'down': ctx.rotate(Math.PI / 2); break;
      case 'left': ctx.rotate(Math.PI); break;
      case 'right': break;
    }
    // Chevron arrow
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-5, 5);
    ctx.moveTo(0, -5);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 5);
    ctx.strokeStyle = COLORS.metalLight;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Building outline
  ctx.strokeStyle = '#202025';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
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
  const size = enemy.isBoss ? 28 : 18;

  // Enemy shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(position.x + 2, position.y + size/3, size/2, size/4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Enemy body color based on faction
  let baseColor: string;
  let accentColor: string;
  switch (enemy.faction) {
    case 'hive':
      baseColor = COLORS.hive;
      accentColor = '#a03030';
      break;
    case 'machines':
      baseColor = COLORS.machines;
      accentColor = '#5060a0';
      break;
    case 'void':
      baseColor = COLORS.void_faction;
      accentColor = '#8030a0';
      break;
    default:
      baseColor = '#802020';
      accentColor = '#a04040';
  }

  // Draw based on faction style
  if (enemy.faction === 'machines') {
    // Mechanical enemy - angular shape
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.moveTo(position.x, position.y - size/2);
    ctx.lineTo(position.x + size/2, position.y);
    ctx.lineTo(position.x, position.y + size/2);
    ctx.lineTo(position.x - size/2, position.y);
    ctx.closePath();
    ctx.fill();

    // Metal highlights
    ctx.strokeStyle = COLORS.metalLight;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Core light
    ctx.fillStyle = '#6080c0';
    ctx.beginPath();
    ctx.arc(position.x, position.y, size/6, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.faction === 'void') {
    // Void enemy - ethereal
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size/2, 0, Math.PI * 2);
    ctx.fill();

    // Inner glow
    ctx.fillStyle = 'rgba(150, 80, 200, 0.5)';
    ctx.beginPath();
    ctx.arc(position.x, position.y, size/3, 0, Math.PI * 2);
    ctx.fill();

    // Void tendrils
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI / 2) + (Date.now() / 500);
      ctx.beginPath();
      ctx.moveTo(position.x, position.y);
      ctx.lineTo(
        position.x + Math.cos(angle) * size * 0.7,
        position.y + Math.sin(angle) * size * 0.7
      );
      ctx.stroke();
    }
  } else {
    // Hive enemy - organic
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size/2, 0, Math.PI * 2);
    ctx.fill();

    // Chitin plates
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(position.x - size/6, position.y - size/6, size/4, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#c04040';
    ctx.beginPath();
    ctx.arc(position.x - 3, position.y - 2, 2, 0, Math.PI * 2);
    ctx.arc(position.x + 3, position.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Boss indicator
  if (enemy.isBoss) {
    ctx.strokeStyle = COLORS.warning;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size/2 + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Crown spikes
    ctx.fillStyle = COLORS.warning;
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI/2 + (i - 1) * 0.4;
      const sx = position.x + Math.cos(angle) * (size/2 + 2);
      const sy = position.y + Math.sin(angle) * (size/2 + 2);
      ctx.beginPath();
      ctx.moveTo(sx - 3, sy + 3);
      ctx.lineTo(sx, sy - 4);
      ctx.lineTo(sx + 3, sy + 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Flying indicator
  if (enemy.canFly) {
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(position.x, position.y, size / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Health bar - industrial style
  const healthPercent = enemy.hp / enemy.maxHp;
  const barWidth = size + 6;
  const barHeight = 3;
  const barX = position.x - barWidth / 2;
  const barY = position.y - size / 2 - 8;

  ctx.fillStyle = '#101010';
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

  ctx.fillStyle = healthPercent > 0.5 ? '#508050' : healthPercent > 0.25 ? '#a08030' : '#803030';
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
}

// ============================================================================
// PLAYER
// ============================================================================

function renderPlayer(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { player } = state;
  const { position } = player;
  const size = 22;

  // Aim direction calculation
  const angle = Math.atan2(
    state.input.mouseWorldY - position.y,
    state.input.mouseWorldX - position.x
  );

  if (player.isDead) {
    // Dead mech - wreckage
    ctx.fillStyle = COLORS.metalDark;
    ctx.beginPath();
    ctx.arc(position.x, position.y, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Damage marks
    ctx.fillStyle = COLORS.rust;
    ctx.fillRect(position.x - 4, position.y - 2, 8, 4);

    // Sparks
    ctx.fillStyle = '#c06020';
    ctx.beginPath();
    ctx.arc(position.x + 3, position.y - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(position.x + 2, position.y + size/3, size/2, size/4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Invincibility shield effect
  if (player.invincible) {
    ctx.fillStyle = 'rgba(100, 160, 200, 0.2)';
    ctx.beginPath();
    ctx.arc(position.x, position.y, size + 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(150, 200, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(position.x, position.y, size + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Mech body - hexagonal shape
  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate(angle);

  // Main hull
  ctx.fillStyle = COLORS.metalDark;
  ctx.beginPath();
  ctx.moveTo(size/2 + 2, 0);
  ctx.lineTo(size/3, -size/2);
  ctx.lineTo(-size/3, -size/2);
  ctx.lineTo(-size/2, 0);
  ctx.lineTo(-size/3, size/2);
  ctx.lineTo(size/3, size/2);
  ctx.closePath();
  ctx.fill();

  // Hull highlight
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(size/2, 0);
  ctx.lineTo(size/3 - 2, -size/2 + 3);
  ctx.lineTo(-size/3 + 2, -size/2 + 3);
  ctx.lineTo(-size/2 + 2, 0);
  ctx.lineTo(-size/3 + 2, size/2 - 3);
  ctx.lineTo(size/3 - 2, size/2 - 3);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#405060';
  ctx.beginPath();
  ctx.arc(0, 0, size/4, 0, Math.PI * 2);
  ctx.fill();

  // Cockpit glass
  ctx.fillStyle = '#608090';
  ctx.beginPath();
  ctx.arc(-1, -1, size/6, 0, Math.PI * 2);
  ctx.fill();

  // Weapon mount
  ctx.fillStyle = COLORS.metal;
  ctx.fillRect(size/3, -3, size/3, 6);

  // Weapon barrel
  ctx.fillStyle = COLORS.metalDark;
  ctx.fillRect(size/2, -2, size/3, 4);

  // Thruster exhausts
  ctx.fillStyle = '#303030';
  ctx.fillRect(-size/2 - 2, -4, 4, 3);
  ctx.fillRect(-size/2 - 2, 1, 4, 3);

  ctx.restore();

  // Engine glow
  const thrustGlow = 0.3 + Math.sin(Date.now() / 100) * 0.1;
  ctx.fillStyle = `rgba(180, 100, 40, ${thrustGlow})`;
  ctx.beginPath();
  ctx.arc(
    position.x - Math.cos(angle) * (size/2 + 2),
    position.y - Math.sin(angle) * (size/2 + 2),
    4, 0, Math.PI * 2
  );
  ctx.fill();

  // Commander mode indicator - tactical overlay
  if (player.commanderMode) {
    ctx.strokeStyle = COLORS.warning;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.arc(position.x, position.y, size + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Direction markers
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.fillStyle = COLORS.warning;
      ctx.beginPath();
      ctx.arc(
        position.x + Math.cos(a) * (size + 8),
        position.y + Math.sin(a) * (size + 8),
        2, 0, Math.PI * 2
      );
      ctx.fill();
    }
  }
}

// ============================================================================
// PROJECTILES
// ============================================================================

function renderProjectiles(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const proj of state.projectiles) {
    let color: string;
    let glowColor: string;
    switch (proj.owner) {
      case 'player':
        color = COLORS.playerProjectile;
        glowColor = 'rgba(192, 208, 0, 0.4)';
        break;
      case 'turret':
        color = COLORS.turretProjectile;
        glowColor = 'rgba(208, 96, 0, 0.4)';
        break;
      case 'enemy':
        color = COLORS.enemyProjectile;
        glowColor = 'rgba(192, 32, 32, 0.4)';
        break;
      default:
        color = '#ffffff';
        glowColor = 'rgba(255, 255, 255, 0.3)';
    }

    const angle = Math.atan2(proj.velocity.y, proj.velocity.x);
    const size = proj.explosive ? 6 : 4;

    // Projectile glow
    ctx.fillStyle = glowColor;
    ctx.beginPath();
    ctx.arc(proj.position.x, proj.position.y, size + 3, 0, Math.PI * 2);
    ctx.fill();

    // Projectile core
    ctx.fillStyle = color;
    ctx.save();
    ctx.translate(proj.position.x, proj.position.y);
    ctx.rotate(angle);

    // Elongated bullet shape
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size/2, -size/2);
    ctx.lineTo(-size, 0);
    ctx.lineTo(-size/2, size/2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Trail - multiple segments for smoke effect
    const trailSegments = 3;
    for (let i = 1; i <= trailSegments; i++) {
      const alpha = 0.3 - (i * 0.08);
      const trailDist = i * 6;
      ctx.fillStyle = `rgba(100, 100, 90, ${alpha})`;
      ctx.beginPath();
      ctx.arc(
        proj.position.x - Math.cos(angle) * trailDist,
        proj.position.y - Math.sin(angle) * trailDist,
        size - i, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // Explosive indicator
    if (proj.explosive) {
      ctx.strokeStyle = COLORS.warning;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(proj.position.x, proj.position.y, size + 1, 0, Math.PI * 2);
      ctx.stroke();
    }
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
  const hudY = canvasHeight - 90;

  // HUD background panel
  ctx.fillStyle = 'rgba(20, 20, 25, 0.9)';
  ctx.fillRect(hudX - 5, hudY - 5, 220, 85);
  ctx.strokeStyle = '#404050';
  ctx.lineWidth = 1;
  ctx.strokeRect(hudX - 5, hudY - 5, 220, 85);

  // Corner accents
  ctx.fillStyle = '#505060';
  ctx.fillRect(hudX - 5, hudY - 5, 8, 2);
  ctx.fillRect(hudX - 5, hudY - 5, 2, 8);
  ctx.fillRect(hudX + 207, hudY + 72, 8, 2);
  ctx.fillRect(hudX + 213, hudY + 66, 2, 8);

  // Health bar
  ctx.fillStyle = '#101015';
  ctx.fillRect(hudX, hudY, 200, 18);

  const healthPct = player.hp / player.maxHp;
  ctx.fillStyle = healthPct > 0.5 ? '#508050' : healthPct > 0.25 ? '#a08030' : '#803030';
  ctx.fillRect(hudX + 1, hudY + 1, 198 * healthPct, 16);

  // Health bar segments
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  for (let i = 1; i < 10; i++) {
    ctx.beginPath();
    ctx.moveTo(hudX + i * 20, hudY);
    ctx.lineTo(hudX + i * 20, hudY + 18);
    ctx.stroke();
  }

  ctx.strokeStyle = '#606070';
  ctx.strokeRect(hudX, hudY, 200, 18);

  ctx.fillStyle = '#c0c0b0';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`HULL ${Math.floor(player.hp)}/${player.maxHp}`, hudX + 100, hudY + 13);

  // Energy bar
  ctx.fillStyle = '#101015';
  ctx.fillRect(hudX, hudY + 22, 200, 14);

  ctx.fillStyle = '#406080';
  ctx.fillRect(hudX + 1, hudY + 23, 198 * (player.energy / player.maxEnergy), 12);

  ctx.strokeStyle = '#506070';
  ctx.strokeRect(hudX, hudY + 22, 200, 14);

  ctx.fillStyle = '#a0b0c0';
  ctx.font = '10px monospace';
  ctx.fillText(`POWER ${Math.floor(player.energy)}`, hudX + 100, hudY + 33);

  // Weapon indicator
  ctx.textAlign = 'left';
  ctx.fillStyle = '#808080';
  ctx.font = '9px monospace';
  ctx.fillText('WEAPON', hudX, hudY + 50);
  ctx.fillStyle = '#c0c0b0';
  ctx.fillText(player.currentWeapon.toUpperCase(), hudX + 50, hudY + 50);

  // Abilities panel
  ctx.fillStyle = 'rgba(20, 20, 25, 0.9)';
  ctx.fillRect(hudX + 220, hudY - 5, 190, 85);
  ctx.strokeStyle = '#404050';
  ctx.strokeRect(hudX + 220, hudY - 5, 190, 85);

  let abilityX = hudX + 228;
  for (const ability of player.abilities) {
    const abilityState = player.abilityStates[ability];
    const ready = abilityState.cooldownRemaining <= 0 && !abilityState.active;

    // Ability button background
    ctx.fillStyle = '#101015';
    ctx.fillRect(abilityX, hudY, 38, 38);

    if (abilityState.active) {
      ctx.fillStyle = 'rgba(80, 160, 80, 0.3)';
      ctx.fillRect(abilityX + 1, hudY + 1, 36, 36);
    } else if (ready) {
      ctx.fillStyle = 'rgba(60, 80, 100, 0.3)';
      ctx.fillRect(abilityX + 1, hudY + 1, 36, 36);
    }

    // Cooldown overlay
    if (abilityState.cooldownRemaining > 0) {
      const cdPct = abilityState.cooldownRemaining / 10; // Assume 10s max cooldown
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(abilityX + 1, hudY + 1, 36, 36 * Math.min(cdPct, 1));
    }

    ctx.strokeStyle = abilityState.active ? '#70a060' : ready ? '#607080' : '#303040';
    ctx.lineWidth = ready ? 2 : 1;
    ctx.strokeRect(abilityX, hudY, 38, 38);

    ctx.fillStyle = ready ? '#c0c0b0' : '#606060';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ability.slice(0, 4).toUpperCase(), abilityX + 19, hudY + 16);

    if (abilityState.cooldownRemaining > 0) {
      ctx.fillStyle = '#a08030';
      ctx.fillText(`${Math.ceil(abilityState.cooldownRemaining)}`, abilityX + 19, hudY + 30);
    }

    abilityX += 42;
  }

  // Ability label
  ctx.fillStyle = '#606060';
  ctx.font = '8px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ABILITIES [1-4]', hudX + 228, hudY + 52);

  // Respawn overlay
  if (player.isDead) {
    ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
    ctx.fillRect(canvasWidth / 2 - 120, canvasHeight / 2 - 40, 240, 80);
    ctx.strokeStyle = '#803030';
    ctx.lineWidth = 2;
    ctx.strokeRect(canvasWidth / 2 - 120, canvasHeight / 2 - 40, 240, 80);

    ctx.fillStyle = '#c03030';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('MECH DESTROYED', canvasWidth / 2, canvasHeight / 2 - 8);

    ctx.fillStyle = '#a0a090';
    ctx.font = '14px monospace';
    ctx.fillText(`RECONSTRUCTING: ${Math.ceil(player.respawnTimer)}s`, canvasWidth / 2, canvasHeight / 2 + 20);
  }
}

function renderResources(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Panel background
  ctx.fillStyle = 'rgba(15, 15, 20, 0.92)';
  ctx.fillRect(10, 10, 190, 210);
  ctx.strokeStyle = '#404050';
  ctx.lineWidth = 1;
  ctx.strokeRect(10, 10, 190, 210);

  // Header
  ctx.fillStyle = '#505060';
  ctx.fillRect(10, 10, 190, 20);
  ctx.fillStyle = '#b0b0a0';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('INVENTORY', 105, 24);

  // Corner bolts
  ctx.fillStyle = '#606070';
  ctx.fillRect(12, 12, 4, 4);
  ctx.fillRect(194, 12, 4, 4);

  const resources = [
    { key: 'iron_ore', label: 'IRON ORE', color: '#8a7050' },
    { key: 'copper_ore', label: 'COPPER ORE', color: '#a06840' },
    { key: 'coal', label: 'COAL', color: '#404040' },
    { key: 'stone', label: 'STONE', color: '#606060' },
    { key: 'iron_ingot', label: 'IRON INGOT', color: '#7080a0' },
    { key: 'copper_wire', label: 'COPPER WIRE', color: '#c08050' },
    { key: 'steel', label: 'STEEL', color: '#8090a0' },
    { key: 'circuits', label: 'CIRCUITS', color: '#50a070' },
    { key: 'biomass', label: 'BIOMASS', color: '#608040' },
    { key: 'crystal_shards', label: 'CRYSTALS', color: '#8060b0' },
    { key: 'dark_matter', label: 'DARK MATTER', color: '#6040a0' },
  ];

  let y = 42;
  ctx.textAlign = 'left';
  for (const { key, label, color } of resources) {
    const amount = state.resources[key as keyof typeof state.resources] || 0;
    if (amount > 0 || ['iron_ore', 'copper_ore', 'coal', 'stone'].includes(key)) {
      // Resource icon
      ctx.fillStyle = color;
      ctx.fillRect(18, y - 8, 8, 8);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.strokeRect(18, y - 8, 8, 8);

      // Resource name
      ctx.fillStyle = '#909080';
      ctx.font = '9px monospace';
      ctx.fillText(label, 32, y);

      // Resource amount
      ctx.fillStyle = '#c0c0b0';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${amount}`, 190, y);
      ctx.textAlign = 'left';

      y += 16;
    }
  }
}

function renderWaveInfo(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number): void {
  const panelX = canvasWidth - 210;

  // Panel background
  ctx.fillStyle = 'rgba(15, 15, 20, 0.92)';
  ctx.fillRect(panelX, 10, 200, 70);
  ctx.strokeStyle = '#404050';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, 10, 200, 70);

  // Header
  ctx.fillStyle = state.activeWave ? '#803030' : '#505060';
  ctx.fillRect(panelX, 10, 200, 18);
  ctx.fillStyle = '#b0b0a0';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(state.activeWave ? 'WAVE IN PROGRESS' : 'DEFENSE STATUS', panelX + 100, 23);

  // Wave counter
  ctx.fillStyle = '#808080';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('WAVES CLEARED', panelX + 10, 42);
  ctx.fillStyle = '#c0c0b0';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`${state.wavesCompleted}`, panelX + 190, 42);

  if (state.activeWave) {
    // Enemy count
    ctx.fillStyle = '#a04040';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('HOSTILES', panelX + 10, 60);

    ctx.fillStyle = '#c0c0b0';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${state.enemies.size} / ${state.activeWave.totalEnemies}`, panelX + 190, 60);

    // Progress bar
    const progress = 1 - (state.enemies.size / state.activeWave.totalEnemies);
    ctx.fillStyle = '#101015';
    ctx.fillRect(panelX + 10, 66, 180, 6);
    ctx.fillStyle = '#508050';
    ctx.fillRect(panelX + 10, 66, 180 * progress, 6);
  } else {
    // Ready indicator
    ctx.fillStyle = '#506050';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[ V ] SUMMON WAVE', panelX + 100, 62);
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
  const panelX = canvasWidth - 180;
  const panelY = canvasHeight - 105;

  // Panel background
  ctx.fillStyle = 'rgba(15, 15, 20, 0.8)';
  ctx.fillRect(panelX, panelY, 170, 95);
  ctx.strokeStyle = '#303040';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, 170, 95);

  // Header
  ctx.fillStyle = '#404050';
  ctx.fillRect(panelX, panelY, 170, 14);
  ctx.fillStyle = '#808080';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('CONTROLS', panelX + 85, panelY + 10);

  const controls = [
    { key: 'WASD', action: 'MOVE' },
    { key: 'MOUSE', action: 'AIM/FIRE' },
    { key: 'TAB', action: 'BUILD MENU' },
    { key: 'SPACE', action: 'DASH' },
    { key: 'Q', action: 'COMMANDER' },
  ];

  ctx.font = '9px monospace';
  let y = panelY + 28;
  for (const { key, action } of controls) {
    // Key
    ctx.fillStyle = '#606060';
    ctx.textAlign = 'left';
    ctx.fillText(key, panelX + 8, y);

    // Action
    ctx.fillStyle = '#909080';
    ctx.textAlign = 'right';
    ctx.fillText(action, panelX + 162, y);

    y += 14;
  }
}
