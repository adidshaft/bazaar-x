import * as Phaser from "phaser";

type CharacterPalette = {
  skin: string;
  hair: string;
  outfit: string;
  accent: string;
};

type Direction = "down" | "up" | "left" | "right";
type Action = "idle" | "walk" | "inspect" | "interact" | "celebrate" | "work";

const directions: Direction[] = ["down", "up", "left", "right"];
const actions: Action[] = ["idle", "walk", "inspect", "interact", "celebrate", "work"];

const characterPalettes: Record<string, CharacterPalette> = {
  player: { skin: "#ffd7ad", hair: "#7a472a", outfit: "#f4c65c", accent: "#2f2319" },
  "npc-keeper": { skin: "#f6d2b0", hair: "#3a2c28", outfit: "#6fa17a", accent: "#d5efe0" },
  "npc-shopkeeper": { skin: "#ffd3a8", hair: "#4b2d22", outfit: "#ff9265", accent: "#fff0c9" },
  "npc-supplier": { skin: "#f5d3b2", hair: "#402920", outfit: "#8db8ff", accent: "#eef6ff" },
  "npc-worker": { skin: "#f2c9a4", hair: "#5b3825", outfit: "#c96d5c", accent: "#fff2da" },
  "npc-treasurer": { skin: "#f5d7b6", hair: "#3d2a23", outfit: "#d7c56e", accent: "#fff9d2" },
  "npc-governor": { skin: "#f5d7b6", hair: "#312431", outfit: "#b388ff", accent: "#f7efff" },
};

const buildingPalette = {
  outline: "#2f2319",
  plaster: "#d8c49c",
  wood: "#7d5a39",
  roofWarm: "#b8644e",
  roofCool: "#5b6775",
  glow: "#f8e29f",
};

function createCanvas(scene: Phaser.Scene, key: string, width: number, height: number) {
  const existing = scene.textures.get(key);
  if (existing && existing.key !== "__MISSING") {
    return null;
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    return null;
  }
  const ctx = texture.context as CanvasRenderingContext2D;
  ctx.imageSmoothingEnabled = false;
  return texture;
}

function fill(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function outline(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
}

function drawCharacterFrame(
  scene: Phaser.Scene,
  key: string,
  palette: CharacterPalette,
  direction: Direction,
  action: Action,
  frameIndex: number,
) {
  const texture = createCanvas(scene, key, 24, 28);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  const bodyShift = action === "walk" ? (frameIndex === 0 ? 1 : -1) : 0;
  const armLift = action === "celebrate" ? -2 : action === "inspect" || action === "interact" ? -1 : 0;

  fill(ctx, palette.skin, 8, 4, 8, 7);
  fill(ctx, palette.hair, 7, 2, 10, 4);
  fill(ctx, palette.outfit, 6, 11, 12, 10);
  fill(ctx, palette.accent, 9, 14, 6, 3);

  if (direction === "up") {
    fill(ctx, palette.hair, 8, 4, 8, 6);
    fill(ctx, palette.outfit, 7, 11, 10, 8);
  }

  if (direction === "left") {
    fill(ctx, palette.skin, 6, 12 + armLift, 3, 4);
    fill(ctx, palette.skin, 15, 12, 2, 4);
  } else if (direction === "right") {
    fill(ctx, palette.skin, 15, 12 + armLift, 3, 4);
    fill(ctx, palette.skin, 7, 12, 2, 4);
  } else {
    fill(ctx, palette.skin, 5, 13 + armLift, 3, 4);
    fill(ctx, palette.skin, 16, 13 + armLift, 3, 4);
  }

  fill(ctx, palette.outfit, 8 + bodyShift, 20, 3, 6);
  fill(ctx, palette.outfit, 13 - bodyShift, 20, 3, 6);
  fill(ctx, palette.accent, 9, action === "work" ? 16 : 18, 6, 2);
  outline(ctx, "#24190f", 6, 3, 12, 23);

  texture.refresh();
}

function drawBuilding(scene: Phaser.Scene, key: string, config: { roof: string; wall: string; banner: string }) {
  const texture = createCanvas(scene, key, 112, 96);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  fill(ctx, config.roof, 10, 16, 92, 26);
  fill(ctx, buildingPalette.plaster, 18, 38, 76, 44);
  fill(ctx, config.wall, 24, 44, 64, 32);
  fill(ctx, buildingPalette.wood, 44, 58, 24, 24);
  fill(ctx, buildingPalette.glow, 26, 48, 14, 12);
  fill(ctx, buildingPalette.glow, 72, 48, 14, 12);
  fill(ctx, config.banner, 48, 30, 16, 14);
  outline(ctx, buildingPalette.outline, 18, 38, 76, 44);
  outline(ctx, buildingPalette.outline, 10, 16, 92, 26);
  texture.refresh();
}

function drawInteriorProp(scene: Phaser.Scene, key: string, base: string, accent: string) {
  const texture = createCanvas(scene, key, 96, 64);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  fill(ctx, base, 12, 10, 72, 42);
  fill(ctx, accent, 18, 16, 60, 30);
  fill(ctx, buildingPalette.glow, 34, 22, 28, 10);
  outline(ctx, buildingPalette.outline, 12, 10, 72, 42);
  texture.refresh();
}

function drawFxTexture(scene: Phaser.Scene, key: string, color: string) {
  const texture = createCanvas(scene, key, 48, 48);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  const gradient = ctx.createRadialGradient(24, 24, 4, 24, 24, 24);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 48, 48);
  texture.refresh();
}

function drawQuestMarker(scene: Phaser.Scene) {
  const texture = createCanvas(scene, "fx-quest-marker", 24, 32);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  fill(ctx, "#f7d669", 6, 2, 12, 12);
  fill(ctx, "#f16f51", 9, 17, 6, 10);
  outline(ctx, "#2f2319", 6, 2, 12, 12);
  texture.refresh();
}

export function ensureGeneratedSpriteTextures(scene: Phaser.Scene) {
  Object.entries(characterPalettes).forEach(([characterId, palette]) => {
    directions.forEach((direction) => {
      actions.forEach((action) => {
        const frames = action === "walk" || action === "work" ? [0, 1] : [0];
        frames.forEach((frameIndex) => {
          drawCharacterFrame(
            scene,
            `${characterId}-${direction}-${action}-${frameIndex}`,
            palette,
            direction,
            action,
            frameIndex,
          );
        });
      });
    });
  });

  drawBuilding(scene, "building-keep", {
    roof: buildingPalette.roofCool,
    wall: "#708192",
    banner: "#f0b85f",
  });
  drawBuilding(scene, "building-forge", {
    roof: buildingPalette.roofWarm,
    wall: "#a46b4e",
    banner: "#ffd381",
  });
  drawBuilding(scene, "building-depot", {
    roof: "#6b88a2",
    wall: "#92734e",
    banner: "#d9efff",
  });
  drawBuilding(scene, "building-guild", {
    roof: "#8e6a58",
    wall: "#8a5a49",
    banner: "#f9d4b5",
  });
  drawBuilding(scene, "building-treasury", {
    roof: "#8c7d58",
    wall: "#74665d",
    banner: "#fff3b5",
  });
  drawBuilding(scene, "building-council", {
    roof: "#61667b",
    wall: "#8f8aa0",
    banner: "#e9d1ff",
  });

  drawInteriorProp(scene, "interior-forge", "#6f4e38", "#c98a57");
  drawInteriorProp(scene, "interior-depot", "#6d5e49", "#8da2b8");
  drawInteriorProp(scene, "interior-treasury", "#5d5a50", "#c0b06d");
  drawInteriorProp(scene, "interior-council", "#554e68", "#bda3e9");

  drawFxTexture(scene, "fx-glow", "rgba(248,226,159,0.9)");
  drawFxTexture(scene, "fx-coin", "rgba(248,214,111,0.95)");
  drawFxTexture(scene, "fx-dust", "rgba(255,240,210,0.78)");
  drawQuestMarker(scene);
}

function registerCharacterAnimations(scene: Phaser.Scene, characterId: string) {
  directions.forEach((direction) => {
    const walkKey = `${characterId}:walk:${direction}`;
    if (!scene.anims.exists(walkKey)) {
      scene.anims.create({
        key: walkKey,
        frames: [
          { key: `${characterId}-${direction}-walk-0` },
          { key: `${characterId}-${direction}-walk-1` },
        ],
        repeat: -1,
        frameRate: 6,
      });
    }

    const workKey = `${characterId}:work:${direction}`;
    if (!scene.anims.exists(workKey)) {
      scene.anims.create({
        key: workKey,
        frames: [
          { key: `${characterId}-${direction}-work-0` },
          { key: `${characterId}-${direction}-work-1` },
        ],
        repeat: -1,
        frameRate: 5,
      });
    }
  });
}

export function registerGeneratedAnimations(scene: Phaser.Scene) {
  Object.keys(characterPalettes).forEach((characterId) => {
    registerCharacterAnimations(scene, characterId);
  });
}
