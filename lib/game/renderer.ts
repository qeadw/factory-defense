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

// Cache for powered tiles - computed once per frame
let poweredTilesCache: Set<string> | null = null;
let poweredTilesCacheFrame = -1;

function computePoweredTiles(state: GameState): Set<string> {
  const powered = new Set<string>();

  for (const building of state.buildings.values()) {
    if (building.type === 'coal_generator' || building.type === 'steam_generator' || building.type === 'fusion_reactor' || building.type === 'core') {
      let radius: number;
      if (building.type === 'core') {
        radius = 36;
      } else if (building.type === 'coal_generator') {
        const gen = building as any;
        if (gen.fuelStored <= 0) continue;
        radius = 5;
      } else if (building.type === 'steam_generator') {
        radius = 8;
      } else {
        radius = 15;
      }

      const centerX = building.gridX + building.width / 2;
      const centerY = building.gridY + building.height / 2;
      const radiusSq = radius * radius;

      // Only check tiles within bounding box
      const minX = Math.max(0, Math.floor(centerX - radius));
      const maxX = Math.min(state.mapWidth - 1, Math.ceil(centerX + radius));
      const minY = Math.max(0, Math.floor(centerY - radius));
      const maxY = Math.min(state.mapHeight - 1, Math.ceil(centerY + radius));

      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x + 0.5 - centerX;
          const dy = y + 0.5 - centerY;
          if (dx * dx + dy * dy <= radiusSq) {
            powered.add(`${x},${y}`);
          }
        }
      }
    }
  }

  return powered;
}

function isTilePowered(state: GameState, tileX: number, tileY: number): boolean {
  // Use cached powered tiles
  if (poweredTilesCacheFrame !== state.tick) {
    poweredTilesCache = computePoweredTiles(state);
    poweredTilesCacheFrame = state.tick;
  }
  return poweredTilesCache!.has(`${tileX},${tileY}`);
}

// Legacy function kept for compatibility but using new cache
function isTilePoweredLegacy(state: GameState, tileX: number, tileY: number): boolean {
  const tileCenterX = (tileX + 0.5) * TILE_SIZE;
  const tileCenterY = (tileY + 0.5) * TILE_SIZE;

  for (const building of state.buildings.values()) {
    if (building.type === 'coal_generator' || building.type === 'steam_generator' || building.type === 'fusion_reactor' || building.type === 'core') {
      const centerX = (building.gridX + building.width / 2) * TILE_SIZE;
      const centerY = (building.gridY + building.height / 2) * TILE_SIZE;

      let radius: number;
      if (building.type === 'core') {
        radius = 36 * TILE_SIZE; // 4x larger safe zone
      } else if (building.type === 'coal_generator') {
        radius = 5 * TILE_SIZE;
      } else if (building.type === 'steam_generator') {
        radius = 8 * TILE_SIZE;
      } else {
        radius = 15 * TILE_SIZE;
      }

      const dx = tileCenterX - centerX;
      const dy = tileCenterY - centerY;
      if (dx * dx + dy * dy <= radius * radius) {
        return true;
      }
    }
  }
  return false;
}

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

  const zoom = state.camera.zoom;
  const showDetail = zoom >= 0.7; // Skip details when zoomed out
  const showFullDetail = zoom >= 1.0; // Full detail only when zoomed in

  // Pre-compute powered tiles cache for this frame
  if (poweredTilesCacheFrame !== state.tick) {
    poweredTilesCache = computePoweredTiles(state);
    poweredTilesCacheFrame = state.tick;
  }

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = state.tiles[y]?.[x];
      if (!tile) continue;

      const worldX = x * TILE_SIZE;
      const worldY = y * TILE_SIZE;
      const isPowered = poweredTilesCache!.has(`${x},${y}`);

      // Base tile color - different for powered vs unpowered
      if (isPowered) {
        ctx.fillStyle = tile.buildable ? '#3a3a40' : getTileColor(tile.type);
      } else {
        ctx.fillStyle = getTileColor(tile.type);
      }
      ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

      // Skip details when zoomed out for performance
      if (!showDetail) {
        // Just draw deposit markers as simple squares when zoomed out
        if (tile.type.includes('deposit')) {
          const depositColor = tile.type === 'iron_deposit' ? '#7a6040' :
                              tile.type === 'copper_deposit' ? '#8b5535' :
                              tile.type === 'coal_deposit' ? '#252525' : '#555555';
          ctx.fillStyle = depositColor;
          ctx.fillRect(worldX + 4, worldY + 4, TILE_SIZE - 8, TILE_SIZE - 8);
        }
        continue;
      }

      // Medium detail - noise and basic overlays
      const noise = ((x * 7 + y * 13) % 17) / 17;
      ctx.fillStyle = `rgba(0, 0, 0, ${0.05 + noise * 0.08})`;
      ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

      if (isPowered && tile.buildable) {
        ctx.fillStyle = 'rgba(80, 60, 40, 0.08)';
        ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

        // Only draw floor details at full zoom
        if (showFullDetail) {
          ctx.strokeStyle = 'rgba(80, 80, 90, 0.3)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(worldX + 4, worldY + TILE_SIZE / 2);
          ctx.lineTo(worldX + TILE_SIZE - 4, worldY + TILE_SIZE / 2);
          ctx.stroke();

          ctx.fillStyle = 'rgba(90, 90, 100, 0.5)';
          const rivetSize = 2;
          ctx.fillRect(worldX + 2, worldY + 2, rivetSize, rivetSize);
          ctx.fillRect(worldX + TILE_SIZE - 4, worldY + 2, rivetSize, rivetSize);
          ctx.fillRect(worldX + 2, worldY + TILE_SIZE - 4, rivetSize, rivetSize);
          ctx.fillRect(worldX + TILE_SIZE - 4, worldY + TILE_SIZE - 4, rivetSize, rivetSize);
        }
      } else if (tile.buildable) {
        ctx.fillStyle = 'rgba(0, 10, 5, 0.15)';
        ctx.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
      }

      // Grid lines only at medium+ zoom
      if (showDetail) {
        ctx.strokeStyle = isPowered ? 'rgba(50, 50, 55, 0.9)' : 'rgba(20, 20, 25, 0.8)';
        ctx.lineWidth = 1;
        ctx.strokeRect(worldX, worldY, TILE_SIZE, TILE_SIZE);
      }

      // Resource deposits
      if (tile.type.includes('deposit')) {
        const depositColor = tile.type === 'iron_deposit' ? '#7a6040' :
                            tile.type === 'copper_deposit' ? '#8b5535' :
                            tile.type === 'coal_deposit' ? '#252525' : '#555555';

        if (showFullDetail) {
          // Full detail ore chunks
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

            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(ox - size/4, oy - size/2, size/2, size/4);
          }
        } else {
          // Simplified ore marker
          ctx.fillStyle = depositColor;
          ctx.fillRect(worldX + 6, worldY + 6, TILE_SIZE - 12, TILE_SIZE - 12);
        }
      }
    }
  }
}

function getTileColor(type: TileType): string {
  return COLORS[type] || COLORS.grass;
}

// ============================================================================
// POWER RADII (only core now - generators add to global grid)
// ============================================================================

function renderPowerRadii(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Only render core's power area - generators just add to the grid
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
  const ITEM_COLORS: Record<string, string> = {
    iron_ore: '#8a7a6a',
    copper_ore: '#c07040',
    coal: '#2a2a2a',
    stone: '#6a6a6a',
    iron_ingot: '#b0b0b0',
    copper_ingot: '#e08050',
    copper_wire: '#d07040',
    silicon: '#a0a0c0',
    steel: '#808090',
    circuits: '#40a040',
    glass: '#a0c0d0',
    biomass: '#50a050',
    crystal_shards: '#8040c0',
    dark_matter: '#200040',
    void_essence: '#6020a0',
  };

  for (const building of state.buildings.values()) {
    if (building.type !== 'conveyor' && building.type !== 'conveyor_junction' && building.type !== 'conveyor_router') {
      continue;
    }

    const conveyor = building as any;
    if (!conveyor.items || conveyor.items.length === 0) continue;

    const baseX = building.gridX * TILE_SIZE;
    const baseY = building.gridY * TILE_SIZE;
    const dir = building.direction || 'right';

    for (const item of conveyor.items) {
      // Calculate item position - smooth center-to-center movement
      // Progress 0 = center of current tile, Progress 1 = center of next tile
      const progress = Math.min(item.progress, 1);
      const centerX = baseX + TILE_SIZE / 2;
      const centerY = baseY + TILE_SIZE / 2;

      let itemX = centerX;
      let itemY = centerY;

      // Move from center toward the exit direction
      switch (dir) {
        case 'right':
          itemX = centerX + progress * TILE_SIZE;
          break;
        case 'left':
          itemX = centerX - progress * TILE_SIZE;
          break;
        case 'down':
          itemY = centerY + progress * TILE_SIZE;
          break;
        case 'up':
          itemY = centerY - progress * TILE_SIZE;
          break;
      }

      // Draw item as a small colored square with border
      const itemSize = TILE_SIZE * 0.35;
      const color = ITEM_COLORS[item.resource] || '#808080';

      // Shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(itemX - itemSize/2 + 1, itemY - itemSize/2 + 1, itemSize, itemSize);

      // Item body
      ctx.fillStyle = color;
      ctx.fillRect(itemX - itemSize/2, itemY - itemSize/2, itemSize, itemSize);

      // Highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(itemX - itemSize/2, itemY - itemSize/2, itemSize, itemSize * 0.3);

      // Border
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(itemX - itemSize/2, itemY - itemSize/2, itemSize, itemSize);
    }
  }
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
  const { position, type } = enemy;
  const baseSize = enemy.isBoss ? 28 : 18;

  // Enemy shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(position.x + 2, position.y + baseSize/3, baseSize/2, baseSize/4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Render based on enemy type
  switch (type) {
    // ===== HIVE ENEMIES =====
    case 'swarmer':
      renderSwarmer(ctx, position, baseSize * 0.7);
      break;
    case 'spitter':
      renderSpitter(ctx, position, baseSize);
      break;
    case 'brute':
      renderBrute(ctx, position, baseSize * 1.3);
      break;
    case 'queen':
      renderQueen(ctx, position, baseSize * 1.5);
      break;

    // ===== MACHINE ENEMIES =====
    case 'drone':
      renderDrone(ctx, position, baseSize * 0.8);
      break;
    case 'walker':
      renderWalker(ctx, position, baseSize);
      break;
    case 'tank':
      renderTank(ctx, position, baseSize * 1.4);
      break;
    case 'overseer':
      renderOverseer(ctx, position, baseSize * 1.5);
      break;

    // ===== VOID ENEMIES =====
    case 'wraith':
      renderWraith(ctx, position, baseSize * 0.9);
      break;
    case 'corruptor':
      renderCorruptor(ctx, position, baseSize * 1.1);
      break;
    case 'void_lord':
      renderVoidLord(ctx, position, baseSize * 1.6);
      break;

    default:
      // Fallback generic enemy
      ctx.fillStyle = '#802020';
      ctx.beginPath();
      ctx.arc(position.x, position.y, baseSize/2, 0, Math.PI * 2);
      ctx.fill();
  }

  // Boss indicator
  if (enemy.isBoss) {
    ctx.strokeStyle = COLORS.warning;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(position.x, position.y, baseSize/2 + 6, 0, Math.PI * 2);
    ctx.stroke();

    // Crown spikes
    ctx.fillStyle = COLORS.warning;
    for (let i = 0; i < 3; i++) {
      const angle = -Math.PI/2 + (i - 1) * 0.4;
      const sx = position.x + Math.cos(angle) * (baseSize/2 + 4);
      const sy = position.y + Math.sin(angle) * (baseSize/2 + 4);
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
    ctx.arc(position.x, position.y, baseSize / 2 + 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Health bar - industrial style
  const healthPercent = enemy.hp / enemy.maxHp;
  const barWidth = baseSize + 6;
  const barHeight = 3;
  const barX = position.x - barWidth / 2;
  const barY = position.y - baseSize / 2 - 10;

  ctx.fillStyle = '#101010';
  ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

  ctx.fillStyle = healthPercent > 0.5 ? '#508050' : healthPercent > 0.25 ? '#a08030' : '#803030';
  ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
}

// ===== HIVE ENEMY RENDERS =====

function renderSwarmer(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Small bug with legs
  ctx.fillStyle = '#6b1515';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, size/2, size/3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#501010';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const legAngle = -Math.PI/3 + i * Math.PI/3;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + Math.cos(legAngle) * size * 0.6, pos.y + Math.sin(legAngle) * size * 0.4 + 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + Math.cos(Math.PI - legAngle) * size * 0.6, pos.y + Math.sin(legAngle) * size * 0.4 + 3);
    ctx.stroke();
  }

  // Eyes
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(pos.x - 2, pos.y - 2, 1.5, 0, Math.PI * 2);
  ctx.arc(pos.x + 2, pos.y - 2, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function renderSpitter(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Bulbous body
  ctx.fillStyle = '#5a1818';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y + 2, size/2.5, 0, Math.PI * 2);
  ctx.fill();

  // Acid sac (glowing)
  ctx.fillStyle = '#40a040';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size/4, size/3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(100, 255, 100, 0.3)';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size/4, size/2.5, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#6b2020';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size/3, size/4, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#ffff40';
  ctx.beginPath();
  ctx.arc(pos.x - 2, pos.y - size/3, 2, 0, Math.PI * 2);
  ctx.arc(pos.x + 2, pos.y - size/3, 2, 0, Math.PI * 2);
  ctx.fill();
}

function renderBrute(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Armored beetle body
  ctx.fillStyle = '#401515';
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - size/2);
  ctx.lineTo(pos.x + size/2, pos.y);
  ctx.lineTo(pos.x + size/3, pos.y + size/2);
  ctx.lineTo(pos.x - size/3, pos.y + size/2);
  ctx.lineTo(pos.x - size/2, pos.y);
  ctx.closePath();
  ctx.fill();

  // Armor plates
  ctx.strokeStyle = '#602020';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pos.x - size/3, pos.y - size/4);
  ctx.lineTo(pos.x + size/3, pos.y - size/4);
  ctx.moveTo(pos.x - size/4, pos.y + size/6);
  ctx.lineTo(pos.x + size/4, pos.y + size/6);
  ctx.stroke();

  // Horns
  ctx.fillStyle = '#301010';
  ctx.beginPath();
  ctx.moveTo(pos.x - size/4, pos.y - size/2);
  ctx.lineTo(pos.x - size/6, pos.y - size * 0.7);
  ctx.lineTo(pos.x - size/8, pos.y - size/2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(pos.x + size/4, pos.y - size/2);
  ctx.lineTo(pos.x + size/6, pos.y - size * 0.7);
  ctx.lineTo(pos.x + size/8, pos.y - size/2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#ff2020';
  ctx.beginPath();
  ctx.arc(pos.x - 4, pos.y - size/4, 2, 0, Math.PI * 2);
  ctx.arc(pos.x + 4, pos.y - size/4, 2, 0, Math.PI * 2);
  ctx.fill();
}

function renderQueen(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Large abdomen
  ctx.fillStyle = '#501020';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + size/4, size/2, size/2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Thorax
  ctx.fillStyle = '#601525';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size/6, size/3, 0, Math.PI * 2);
  ctx.fill();

  // Crown spines
  ctx.fillStyle = '#801030';
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI/2 + (i - 2) * 0.3;
    ctx.beginPath();
    ctx.moveTo(pos.x + Math.cos(angle) * size/4, pos.y - size/4);
    ctx.lineTo(pos.x + Math.cos(angle) * size/2.5, pos.y - size/2 - 4);
    ctx.lineTo(pos.x + Math.cos(angle + 0.1) * size/4, pos.y - size/4);
    ctx.fill();
  }

  // Multiple eyes
  ctx.fillStyle = '#ff4060';
  for (let i = 0; i < 4; i++) {
    const ex = pos.x - 6 + i * 4;
    ctx.beginPath();
    ctx.arc(ex, pos.y - size/4, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== MACHINE ENEMY RENDERS =====

function renderDrone(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Small diamond body
  ctx.fillStyle = '#253560';
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - size/3);
  ctx.lineTo(pos.x + size/3, pos.y);
  ctx.lineTo(pos.x, pos.y + size/3);
  ctx.lineTo(pos.x - size/3, pos.y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#4060a0';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Propeller blades (animated)
  const rot = Date.now() / 50;
  ctx.strokeStyle = '#6080b0';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const angle = rot + i * Math.PI/2;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + Math.cos(angle) * size/2.5, pos.y + Math.sin(angle) * size/2.5);
    ctx.stroke();
  }

  // Center light
  ctx.fillStyle = '#80c0ff';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

function renderWalker(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Body
  ctx.fillStyle = '#304070';
  ctx.fillRect(pos.x - size/3, pos.y - size/3, size * 0.66, size/2);

  // Head/sensor
  ctx.fillStyle = '#405080';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size/3, size/4, Math.PI, 0);
  ctx.fill();

  // Legs
  ctx.strokeStyle = '#506090';
  ctx.lineWidth = 3;
  // Left leg
  ctx.beginPath();
  ctx.moveTo(pos.x - size/4, pos.y + size/6);
  ctx.lineTo(pos.x - size/3, pos.y + size/2);
  ctx.stroke();
  // Right leg
  ctx.beginPath();
  ctx.moveTo(pos.x + size/4, pos.y + size/6);
  ctx.lineTo(pos.x + size/3, pos.y + size/2);
  ctx.stroke();

  // Eye/sensor
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size/4, 3, 0, Math.PI * 2);
  ctx.fill();

  // Metal highlights
  ctx.strokeStyle = '#7090c0';
  ctx.lineWidth = 1;
  ctx.strokeRect(pos.x - size/3, pos.y - size/3, size * 0.66, size/2);
}

function renderTank(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Treads
  ctx.fillStyle = '#252535';
  ctx.fillRect(pos.x - size/2, pos.y + size/6, size, size/4);

  // Main body
  ctx.fillStyle = '#354575';
  ctx.fillRect(pos.x - size/2.5, pos.y - size/3, size * 0.8, size/2);

  // Turret
  ctx.fillStyle = '#405585';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size/6, size/4, 0, Math.PI * 2);
  ctx.fill();

  // Cannon
  ctx.fillStyle = '#253050';
  ctx.fillRect(pos.x - 3, pos.y - size/3, 6, -size/3);

  // Armor plates
  ctx.strokeStyle = '#5575a5';
  ctx.lineWidth = 2;
  ctx.strokeRect(pos.x - size/2.5, pos.y - size/3, size * 0.8, size/2);

  // Lights
  ctx.fillStyle = '#60a0ff';
  ctx.fillRect(pos.x - size/3, pos.y - size/4, 4, 4);
  ctx.fillRect(pos.x + size/3 - 4, pos.y - size/4, 4, 4);
}

function renderOverseer(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Floating platform body
  ctx.fillStyle = '#253555';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y, size/2, size/3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Command tower
  ctx.fillStyle = '#354575';
  ctx.fillRect(pos.x - size/6, pos.y - size/2, size/3, size/2);

  // Antenna array
  ctx.strokeStyle = '#5575a5';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(pos.x - size/6 + i * size/6, pos.y - size/2);
    ctx.lineTo(pos.x - size/6 + i * size/6, pos.y - size * 0.7);
    ctx.stroke();
  }

  // Scanner glow
  ctx.fillStyle = 'rgba(100, 160, 255, 0.3)';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Main eye
  ctx.fillStyle = '#ff6060';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y - size/4, 5, 0, Math.PI * 2);
  ctx.fill();
}

// ===== VOID ENEMY RENDERS =====

function renderWraith(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Ghostly wisp body
  const time = Date.now() / 200;

  // Outer glow
  ctx.fillStyle = 'rgba(100, 60, 160, 0.2)';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size * 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Core wisp shape
  ctx.fillStyle = '#4a2070';
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - size/2);
  ctx.quadraticCurveTo(pos.x + size/2, pos.y, pos.x + size/4, pos.y + size/2);
  ctx.quadraticCurveTo(pos.x, pos.y + size/3, pos.x - size/4, pos.y + size/2);
  ctx.quadraticCurveTo(pos.x - size/2, pos.y, pos.x, pos.y - size/2);
  ctx.fill();

  // Floating particles
  ctx.fillStyle = '#8060c0';
  for (let i = 0; i < 3; i++) {
    const px = pos.x + Math.sin(time + i * 2) * size/3;
    const py = pos.y + Math.cos(time + i * 2) * size/4;
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Eyes
  ctx.fillStyle = '#c080ff';
  ctx.beginPath();
  ctx.arc(pos.x - 3, pos.y - 2, 2, 0, Math.PI * 2);
  ctx.arc(pos.x + 3, pos.y - 2, 2, 0, Math.PI * 2);
  ctx.fill();
}

function renderCorruptor(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Tentacled horror
  const time = Date.now() / 300;

  // Body
  ctx.fillStyle = '#3a1860';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size/2.5, 0, Math.PI * 2);
  ctx.fill();

  // Corruption tendrils
  ctx.strokeStyle = '#5030a0';
  ctx.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI / 3) + Math.sin(time + i) * 0.2;
    const len = size * 0.6 + Math.sin(time * 2 + i) * 4;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.quadraticCurveTo(
      pos.x + Math.cos(angle) * len * 0.5,
      pos.y + Math.sin(angle) * len * 0.5 + Math.sin(time + i) * 3,
      pos.x + Math.cos(angle) * len,
      pos.y + Math.sin(angle) * len
    );
    ctx.stroke();
  }

  // Corruption aura
  ctx.fillStyle = 'rgba(80, 40, 120, 0.15)';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size * 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Central eye
  ctx.fillStyle = '#a060e0';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size/5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#200040';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size/8, 0, Math.PI * 2);
  ctx.fill();
}

function renderVoidLord(ctx: CanvasRenderingContext2D, pos: {x: number, y: number}, size: number): void {
  // Massive void entity
  const time = Date.now() / 400;

  // Void rift background
  ctx.fillStyle = 'rgba(40, 20, 80, 0.3)';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size * 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Main body - crystalline void
  ctx.fillStyle = '#2a1050';
  ctx.beginPath();
  ctx.moveTo(pos.x, pos.y - size/2);
  ctx.lineTo(pos.x + size/2, pos.y - size/4);
  ctx.lineTo(pos.x + size/2.5, pos.y + size/3);
  ctx.lineTo(pos.x, pos.y + size/2);
  ctx.lineTo(pos.x - size/2.5, pos.y + size/3);
  ctx.lineTo(pos.x - size/2, pos.y - size/4);
  ctx.closePath();
  ctx.fill();

  // Inner glow
  ctx.fillStyle = '#5030a0';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size/3, 0, Math.PI * 2);
  ctx.fill();

  // Void tendrils
  ctx.strokeStyle = '#7050c0';
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI / 4) + time * 0.5;
    const len = size * 0.7 + Math.sin(time * 3 + i) * 5;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + Math.cos(angle) * len, pos.y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // Multiple eyes
  ctx.fillStyle = '#e080ff';
  const eyePositions = [
    {x: 0, y: -size/4},
    {x: -size/5, y: 0},
    {x: size/5, y: 0},
    {x: 0, y: size/5}
  ];
  for (const ep of eyePositions) {
    ctx.beginPath();
    ctx.arc(pos.x + ep.x, pos.y + ep.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Central void core
  ctx.fillStyle = '#100020';
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, size/6, 0, Math.PI * 2);
  ctx.fill();
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

  ctx.strokeStyle = canPlace ? '#508050' : '#803030';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Building label
  ctx.fillStyle = 'rgba(200, 200, 180, 0.9)';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = getBuildingLabel(state.selectedBuilding);
  if (label) {
    ctx.fillText(label, x + w / 2, y + h / 2 - 6);
  }

  // Direction indicator arrow (for conveyors and directional buildings)
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2 + 4);

  // Rotate based on placement direction
  switch (state.placementDirection) {
    case 'up': ctx.rotate(-Math.PI / 2); break;
    case 'down': ctx.rotate(Math.PI / 2); break;
    case 'left': ctx.rotate(Math.PI); break;
    case 'right': break; // default facing right
  }

  // Draw arrow
  ctx.fillStyle = canPlace ? '#70a060' : '#a05050';
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // Show rotation hint
  ctx.fillStyle = 'rgba(150, 150, 140, 0.8)';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('[E] ROTATE', x + w / 2, y + h + 10);
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

  // Power stats (top right)
  renderPowerStats(ctx, state, canvasWidth);

  // Wave info
  renderWaveInfo(ctx, state, canvasWidth);

  // Controls hint (hidden when build menu is open - HTML overlay handles it)
  if (!state.showBuildMenu) {
    renderControlsHint(ctx, canvasWidth, canvasHeight);
  }
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

function renderPowerStats(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number): void {
  // Calculate power generation and consumption
  let powerGeneration = 0;
  let powerConsumption = 0;

  for (const building of state.buildings.values()) {
    // Power generation
    if (building.type === 'core') {
      powerGeneration += 100; // Core provides 100 power
    } else if (building.type === 'coal_generator') {
      const gen = building as any;
      if (gen.fuelStored > 0) {
        powerGeneration += 20; // Each coal generator provides 20 power
      }
    } else if (building.type === 'steam_generator') {
      powerGeneration += 50;
    } else if (building.type === 'fusion_reactor') {
      powerGeneration += 200;
    }

    // Power consumption
    if (building.powered && BUILDING_DEFINITIONS[building.type].powerRequired) {
      switch (building.type) {
        case 'ore_extractor': powerConsumption += 5; break;
        case 'smelter': powerConsumption += 10; break;
        case 'assembler': powerConsumption += 15; break;
        case 'turret_base': powerConsumption += 8; break;
        case 'wall_turret': powerConsumption += 5; break;
        case 'pump': powerConsumption += 5; break;
        case 'ammo_factory': powerConsumption += 12; break;
        case 'refinery': powerConsumption += 20; break;
        case 'drone_hub': powerConsumption += 15; break;
        default: powerConsumption += 5; break;
      }
    }
  }

  const panelX = canvasWidth - 210;
  const panelY = 90; // Below wave info

  // Panel background
  ctx.fillStyle = 'rgba(15, 15, 20, 0.92)';
  ctx.fillRect(panelX, panelY, 200, 55);
  ctx.strokeStyle = '#404050';
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, 200, 55);

  // Header
  const powerBalance = powerGeneration - powerConsumption;
  ctx.fillStyle = powerBalance >= 0 ? '#406050' : '#804040';
  ctx.fillRect(panelX, panelY, 200, 18);
  ctx.fillStyle = '#b0b0a0';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('POWER GRID', panelX + 100, panelY + 13);

  // Power generation
  ctx.fillStyle = '#50a060';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('GENERATION', panelX + 10, panelY + 32);
  ctx.fillStyle = '#80c080';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`+${powerGeneration}`, panelX + 190, panelY + 32);

  // Power consumption
  ctx.fillStyle = '#a06050';
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CONSUMPTION', panelX + 10, panelY + 46);
  ctx.fillStyle = '#c08080';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText(`-${powerConsumption}`, panelX + 190, panelY + 46);
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
