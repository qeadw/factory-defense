'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  GameState,
  BuildingType,
  Direction,
  TILE_SIZE,
  BUILDING_DEFINITIONS,
} from '@/lib/game/types';
import {
  createInitialState,
  updateGame,
  placeBuilding,
  removeBuilding,
  canPlaceBuilding,
  worldToGrid,
  screenToWorld,
  activateAbility,
  startWave,
  saveGame,
  loadGame,
  deleteSave,
} from '@/lib/game/engine';
import { render } from '@/lib/game/renderer';

// Sample wave config for testing
const SAMPLE_WAVE = {
  id: 'hive_basic',
  name: 'Hive Swarm',
  description: 'A basic wave of hive creatures',
  faction: 'hive' as const,
  baseCost: [{ type: 'iron_ore' as const, amount: 10 }],
  baseReward: [{ type: 'biomass' as const, amount: 20 }, { type: 'crystal_shards' as const, amount: 5 }],
  enemyTypes: [
    { type: 'swarmer' as const, count: 10 },
    { type: 'spitter' as const, count: 3 },
  ],
  availableModifiers: ['swarm' as const, 'fast' as const],
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const [, forceUpdate] = useState({});

  // Initialize game state and load save
  useEffect(() => {
    gameStateRef.current = createInitialState();
    // Try to load saved game
    if (gameStateRef.current) {
      loadGame(gameStateRef.current);
    }
    forceUpdate({});
  }, []);

  // Auto-save every 30 seconds
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (gameStateRef.current) {
        saveGame(gameStateRef.current);
      }
    }, 30000);
    return () => clearInterval(saveInterval);
  }, []);

  // Reset save handler
  const handleResetSave = () => {
    if (confirm('Are you sure you want to reset your save? This cannot be undone.')) {
      deleteSave();
      gameStateRef.current = createInitialState();
      forceUpdate({});
    }
  };

  // Input handling
  useEffect(() => {
    const state = gameStateRef.current;
    if (!state) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      state.input.keys.add(e.code);

      // Toggle build menu
      if (e.code === 'Tab') {
        e.preventDefault();
        state.showBuildMenu = !state.showBuildMenu;
        if (!state.showBuildMenu) {
          state.selectedBuilding = null;
        }
        forceUpdate({});
      }

      // Toggle commander mode
      if (e.code === 'KeyQ') {
        state.player.commanderMode = !state.player.commanderMode;
      }

      // Abilities
      if (e.code === 'Space') {
        e.preventDefault();
        activateAbility(state, 'dash');
      }
      if (e.code === 'Digit1') activateAbility(state, 'shield');
      if (e.code === 'Digit2') activateAbility(state, 'overdrive');
      if (e.code === 'Digit3') activateAbility(state, 'emp');
      if (e.code === 'Digit4') activateAbility(state, 'turret_boost');

      // Rotate placement direction (E key or mouse wheel when building selected)
      if (e.code === 'KeyE' && state.selectedBuilding) {
        const directions: Direction[] = ['right', 'down', 'left', 'up'];
        const currentIdx = directions.indexOf(state.placementDirection);
        state.placementDirection = directions[(currentIdx + 1) % 4];
        forceUpdate({});
      }

      // Building selection hotkeys (avoiding WASD movement keys)
      const buildingKeys: Record<string, BuildingType> = {
        'KeyR': 'ore_extractor',    // R - extRactor
        'KeyF': 'conveyor',          // F - Flow
        'KeyG': 'coal_generator',    // G - Generator
        'KeyT': 'turret_base',       // T - Turret
        'KeyB': 'wall',              // B - Barrier
        'KeyH': 'storage',           // H - Hold/storage
      };
      if (buildingKeys[e.code] && state.unlockedBuildings.has(buildingKeys[e.code])) {
        state.selectedBuilding = buildingKeys[e.code];
        forceUpdate({});
      }

      // Escape to cancel building
      if (e.code === 'Escape') {
        state.selectedBuilding = null;
        state.showBuildMenu = false;
        forceUpdate({});
      }

      // Summon wave with V key
      if (e.code === 'KeyV' && !state.activeWave) {
        startWave(state, SAMPLE_WAVE, []);
        forceUpdate({});
      }

      // Pause
      if (e.code === 'KeyP') {
        state.paused = !state.paused;
        forceUpdate({});
      }

      // Zoom
      if (e.code === 'Minus') {
        state.camera.zoom = Math.max(0.5, state.camera.zoom - 0.1);
      }
      if (e.code === 'Equal') {
        state.camera.zoom = Math.min(2, state.camera.zoom + 0.1);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      state.input.keys.delete(e.code);
    };

    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      state.input.mouseX = e.clientX - rect.left;
      state.input.mouseY = e.clientY - rect.top;

      // Convert to world coordinates
      const worldPos = screenToWorld(
        state.input.mouseX,
        state.input.mouseY,
        state.camera,
        canvas.width,
        canvas.height
      );
      state.input.mouseWorldX = worldPos.x;
      state.input.mouseWorldY = worldPos.y;

      // Update hovered tile
      state.hoveredTile = worldToGrid(worldPos.x, worldPos.y);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        state.input.mouseDown = true;

        // Place building
        if (state.selectedBuilding && state.hoveredTile) {
          const success = placeBuilding(
            state,
            state.selectedBuilding,
            state.hoveredTile.gridX,
            state.hoveredTile.gridY,
            state.placementDirection
          );
          if (success) {
            forceUpdate({});
          }
        }
      } else if (e.button === 2) {
        state.input.rightMouseDown = true;

        // Remove building or cancel selection
        if (state.selectedBuilding) {
          state.selectedBuilding = null;
          forceUpdate({});
        } else if (state.hoveredTile) {
          // Find and remove building at position
          for (const building of state.buildings.values()) {
            if (
              state.hoveredTile.gridX >= building.gridX &&
              state.hoveredTile.gridX < building.gridX + building.width &&
              state.hoveredTile.gridY >= building.gridY &&
              state.hoveredTile.gridY < building.gridY + building.height
            ) {
              removeBuilding(state, building.id);
              forceUpdate({});
              break;
            }
          }
        }
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) state.input.mouseDown = false;
      if (e.button === 2) state.input.rightMouseDown = false;
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      state.camera.zoom = Math.max(0.5, Math.min(2, state.camera.zoom + zoomDelta));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const gameLoop = (timestamp: number) => {
      const state = gameStateRef.current;
      if (!state) {
        animationFrameRef.current = requestAnimationFrame(gameLoop);
        return;
      }

      // Calculate delta time
      const deltaTime = lastTimeRef.current ? (timestamp - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = timestamp;

      // Update
      updateGame(state, Math.min(deltaTime, 0.1)); // Cap delta to prevent huge jumps

      // Render
      render(ctx, state, canvas.width, canvas.height);

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const state = gameStateRef.current;

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', background: '#1a1a2e' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block' }}
      />

      {/* Build menu overlay */}
      {state?.showBuildMenu && (
        <div style={{
          position: 'fixed',
          right: 10,
          top: 80,
          width: 280,
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid #444',
          padding: 10,
          color: 'white',
          fontFamily: 'monospace',
          fontSize: 12,
          maxHeight: 'calc(100vh - 200px)',
          overflowY: 'auto',
        }}>
          <h3 style={{ margin: '0 0 10px 0', textAlign: 'center' }}>BUILD MENU</h3>
          <p style={{ color: '#888', fontSize: 10, marginBottom: 10 }}>Click to select, then click on map to place. Right-click to cancel.</p>

          {Array.from(state.unlockedBuildings).map(buildingType => {
            const def = BUILDING_DEFINITIONS[buildingType];
            if (!def) return null;

            const isSelected = state.selectedBuilding === buildingType;
            const canAfford = def.cost.every(c => (state.resources[c.type] || 0) >= c.amount);

            return (
              <div
                key={buildingType}
                onClick={() => {
                  if (canAfford) {
                    state.selectedBuilding = buildingType;
                    forceUpdate({});
                  }
                }}
                style={{
                  padding: '8px',
                  marginBottom: 5,
                  background: isSelected ? '#004400' : canAfford ? '#333' : '#222',
                  border: isSelected ? '1px solid #00ff00' : '1px solid #444',
                  cursor: canAfford ? 'pointer' : 'not-allowed',
                  opacity: canAfford ? 1 : 0.5,
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{def.name}</div>
                <div style={{ color: '#888', fontSize: 10 }}>
                  {def.cost.length > 0
                    ? def.cost.map(c => `${c.amount} ${c.type.replace(/_/g, ' ')}`).join(', ')
                    : 'Free'}
                </div>
              </div>
            );
          })}

          <div style={{ marginTop: 15, color: '#666', fontSize: 10 }}>
            <div>Hotkeys:</div>
            <div>R - Extractor, F - Conveyor</div>
            <div>G - Generator, T - Turret</div>
            <div>B - Wall, H - Storage</div>
          </div>
        </div>
      )}

      {/* Reset save button */}
      <button
        onClick={handleResetSave}
        style={{
          position: 'fixed',
          bottom: 10,
          right: 10,
          padding: '8px 16px',
          background: '#802020',
          border: '1px solid #a03030',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: 10,
          cursor: 'pointer',
        }}
      >
        RESET SAVE
      </button>

      {/* Pause overlay */}
      {state?.paused && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: 32,
        }}>
          PAUSED (Press P to resume)
        </div>
      )}
    </div>
  );
}
