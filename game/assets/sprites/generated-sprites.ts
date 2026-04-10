import * as Phaser from "phaser";

type CharacterPalette = {
  mode: "agent" | "human";
  shell: string;
  trim: string;
  accent: string;
  glow: string;
  skin?: string;
  hair?: string;
};

type Direction = "down" | "up" | "left" | "right";
type Action = "idle" | "walk" | "inspect" | "interact" | "celebrate" | "work";

const directions: Direction[] = ["down", "up", "left", "right"];
const actions: Action[] = ["idle", "walk", "inspect", "interact", "celebrate", "work"];

const characterPalettes: Record<string, CharacterPalette> = {
  player: {
    mode: "agent",
    shell: "#4f6c82",
    trim: "#b7d6e8",
    accent: "#7df0ff",
    glow: "#d8fbff",
  },
  "npc-keeper": {
    mode: "human",
    shell: "#496356",
    trim: "#dbeadd",
    accent: "#7fc7a1",
    glow: "#dff8e8",
    skin: "#f3d3b7",
    hair: "#332821",
  },
  "npc-shopkeeper": {
    mode: "agent",
    shell: "#8d5b48",
    trim: "#f8d2b8",
    accent: "#ffb071",
    glow: "#fff1dc",
  },
  "npc-supplier": {
    mode: "agent",
    shell: "#486883",
    trim: "#d7e8f6",
    accent: "#85bbff",
    glow: "#e8f4ff",
  },
  "npc-worker": {
    mode: "agent",
    shell: "#6d5867",
    trim: "#f0d5e7",
    accent: "#ff9f8d",
    glow: "#fff0e9",
  },
  "npc-treasurer": {
    mode: "human",
    shell: "#67604f",
    trim: "#efe2c9",
    accent: "#dfc986",
    glow: "#fff8d2",
    skin: "#f2d6bc",
    hair: "#403329",
  },
  "npc-governor": {
    mode: "agent",
    shell: "#4a566f",
    trim: "#e3ddff",
    accent: "#b7a2ff",
    glow: "#f2edff",
  },
};

const buildingPalette = {
  outline: "#1e1711",
  stone: "#6b7683",
  wood: "#5b4333",
  plaster: "#d5dbe0",
  roofSlate: "#495362",
  roofCopper: "#8f5d47",
  roofGreen: "#485f58",
  glow: "#9be7ff",
  lamp: "#ffe6a8",
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

function fill(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function outline(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
}

function drawHumanFrame(
  ctx: CanvasRenderingContext2D,
  palette: CharacterPalette,
  direction: Direction,
  action: Action,
  frameIndex: number,
) {
  const bodyShift = action === "walk" ? (frameIndex === 0 ? 1 : -1) : 0;
  const armLift = action === "celebrate" ? -2 : action === "inspect" || action === "interact" ? -1 : 0;

  fill(ctx, palette.skin!, 8, 4, 8, 7);
  fill(ctx, palette.hair!, 7, 2, 10, 4);
  fill(ctx, palette.shell, 6, 11, 12, 10);
  fill(ctx, palette.trim, 8, 13, 8, 3);
  fill(ctx, palette.accent, 10, 17, 4, 2);

  if (direction === "up") {
    fill(ctx, palette.hair!, 8, 4, 8, 6);
    fill(ctx, palette.shell, 7, 11, 10, 8);
  }

  if (direction === "left") {
    fill(ctx, palette.skin!, 6, 12 + armLift, 3, 4);
    fill(ctx, palette.skin!, 15, 12, 2, 4);
  } else if (direction === "right") {
    fill(ctx, palette.skin!, 15, 12 + armLift, 3, 4);
    fill(ctx, palette.skin!, 7, 12, 2, 4);
  } else {
    fill(ctx, palette.skin!, 5, 13 + armLift, 3, 4);
    fill(ctx, palette.skin!, 16, 13 + armLift, 3, 4);
  }

  fill(ctx, palette.shell, 8 + bodyShift, 20, 3, 6);
  fill(ctx, palette.shell, 13 - bodyShift, 20, 3, 6);
  fill(ctx, palette.trim, 8, action === "work" ? 16 : 18, 8, 2);
  outline(ctx, "#20170f", 6, 3, 12, 23);
}

function drawAgentFrame(
  ctx: CanvasRenderingContext2D,
  palette: CharacterPalette,
  direction: Direction,
  action: Action,
  frameIndex: number,
) {
  const bodyShift = action === "walk" ? (frameIndex === 0 ? 1 : -1) : 0;
  const armLift = action === "celebrate" ? -2 : action === "inspect" || action === "interact" ? -1 : 0;

  fill(ctx, palette.glow, 10, 2, 4, 2);
  fill(ctx, palette.shell, 7, 4, 10, 8);
  fill(ctx, palette.trim, 8, 5, 8, 6);
  fill(ctx, palette.accent, 8, 7, 8, 2);
  fill(ctx, palette.shell, 6, 12, 12, 10);
  fill(ctx, palette.trim, 8, 14, 8, 5);
  fill(ctx, palette.accent, 10, 16, 4, 2);

  if (direction === "up") {
    fill(ctx, palette.trim, 8, 6, 8, 4);
    fill(ctx, palette.accent, 9, 5, 6, 1);
  }

  if (direction === "left") {
    fill(ctx, palette.shell, 5, 13 + armLift, 3, 4);
    fill(ctx, palette.trim, 16, 13, 2, 4);
  } else if (direction === "right") {
    fill(ctx, palette.shell, 16, 13 + armLift, 3, 4);
    fill(ctx, palette.trim, 6, 13, 2, 4);
  } else {
    fill(ctx, palette.shell, 5, 14 + armLift, 3, 4);
    fill(ctx, palette.shell, 16, 14 + armLift, 3, 4);
  }

  fill(ctx, palette.shell, 8 + bodyShift, 22, 3, 4);
  fill(ctx, palette.shell, 13 - bodyShift, 22, 3, 4);
  fill(ctx, palette.accent, 8, action === "work" ? 18 : 20, 8, 1);
  outline(ctx, "#172028", 6, 4, 12, 22);
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
  if (palette.mode === "human") {
    drawHumanFrame(ctx, palette, direction, action, frameIndex);
  } else {
    drawAgentFrame(ctx, palette, direction, action, frameIndex);
  }

  texture.refresh();
}

function drawBuilding(
  scene: Phaser.Scene,
  key: string,
  config: { roof: string; wall: string; banner: string; lamp: string },
) {
  const texture = createCanvas(scene, key, 128, 104);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  fill(ctx, config.roof, 10, 18, 108, 28);
  fill(ctx, buildingPalette.plaster, 20, 42, 88, 50);
  fill(ctx, config.wall, 28, 50, 72, 34);
  fill(ctx, buildingPalette.wood, 50, 66, 28, 26);
  fill(ctx, config.lamp, 30, 56, 14, 14);
  fill(ctx, config.lamp, 84, 56, 14, 14);
  fill(ctx, config.banner, 54, 34, 20, 16);
  fill(ctx, buildingPalette.glow, 34, 60, 6, 6);
  fill(ctx, buildingPalette.glow, 88, 60, 6, 6);
  outline(ctx, buildingPalette.outline, 20, 42, 88, 50);
  outline(ctx, buildingPalette.outline, 10, 18, 108, 28);
  texture.refresh();
}

function drawInteriorProp(scene: Phaser.Scene, key: string, base: string, accent: string, trim: string) {
  const texture = createCanvas(scene, key, 112, 72);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  fill(ctx, base, 12, 12, 88, 48);
  fill(ctx, accent, 18, 18, 76, 34);
  fill(ctx, trim, 32, 24, 48, 12);
  fill(ctx, buildingPalette.lamp, 44, 40, 24, 6);
  outline(ctx, buildingPalette.outline, 12, 12, 88, 48);
  texture.refresh();
}

function drawAmbientProp(
  scene: Phaser.Scene,
  key: string,
  painter: (ctx: CanvasRenderingContext2D) => void,
) {
  const texture = createCanvas(scene, key, 64, 80);
  if (!texture) {
    return;
  }

  painter(texture.context);
  texture.refresh();
}

function drawFxTexture(scene: Phaser.Scene, key: string, color: string, size = 48) {
  const texture = createCanvas(scene, key, size, size);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 4, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  texture.refresh();
}

function drawQuestMarker(scene: Phaser.Scene) {
  const texture = createCanvas(scene, "fx-quest-marker", 28, 36);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  fill(ctx, "#7df0ff", 7, 2, 14, 12);
  fill(ctx, "#20384f", 10, 5, 8, 6);
  fill(ctx, "#f16f51", 11, 17, 6, 12);
  fill(ctx, "#f3f6ff", 12, 7, 4, 2);
  outline(ctx, "#1b2027", 7, 2, 14, 12);
  texture.refresh();
}

function drawSkillAltar(scene: Phaser.Scene) {
  drawAmbientProp(scene, "prop-skill-altar", (ctx) => {
    fill(ctx, "#2d3342", 12, 42, 40, 18);
    fill(ctx, "#5d6879", 16, 46, 32, 10);
    fill(ctx, "#1a2230", 22, 18, 20, 24);
    fill(ctx, "#7df0ff", 24, 20, 16, 12);
    fill(ctx, "#d9fbff", 27, 23, 10, 6);
    fill(ctx, "#8b6dff", 28, 12, 8, 6);
    outline(ctx, "#171813", 12, 18, 40, 42);
  });
}

function drawVeritasScroll(scene: Phaser.Scene) {
  const texture = createCanvas(scene, "fx-veritas-scroll", 28, 32);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  fill(ctx, "#f7f0db", 6, 5, 16, 22);
  fill(ctx, "#dfcda4", 4, 8, 4, 16);
  fill(ctx, "#dfcda4", 20, 8, 4, 16);
  fill(ctx, "#7df0ff", 9, 10, 10, 2);
  fill(ctx, "#7df0ff", 9, 15, 10, 2);
  fill(ctx, "#7df0ff", 9, 20, 7, 2);
  outline(ctx, "#1b2027", 6, 5, 16, 22);
  texture.refresh();
}

function drawHearthFireFrame(scene: Phaser.Scene, key: string, colors: { core: string; mid: string; rim: string }) {
  const texture = createCanvas(scene, key, 32, 40);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  fill(ctx, "#49382f", 8, 28, 16, 8);
  fill(ctx, "#2d2420", 6, 34, 20, 4);
  fill(ctx, colors.rim, 10, 12, 12, 18);
  fill(ctx, colors.mid, 12, 8, 8, 16);
  fill(ctx, colors.core, 14, 4, 4, 12);
  texture.refresh();
}

function ensureGeneratedBitmapFonts(scene: Phaser.Scene) {
  if (scene.cache.bitmapFont.exists("ledger-font")) {
    return;
  }

  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-.#/()<>? ";
  const charsPerRow = 8;
  const cellWidth = 12;
  const cellHeight = 16;
  const rows = Math.ceil(chars.length / charsPerRow);
  const texture = createCanvas(
    scene,
    "font-ledger-image",
    charsPerRow * cellWidth,
    rows * cellHeight,
  );
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  ctx.fillStyle = "#e8fbff";
  ctx.font = "14px monospace";
  ctx.textBaseline = "top";

  [...chars].forEach((character, index) => {
    const x = (index % charsPerRow) * cellWidth;
    const y = Math.floor(index / charsPerRow) * cellHeight;
    ctx.fillText(character, x + 1, y + 1);
  });

  texture.refresh();

  scene.cache.bitmapFont.add("ledger-font", {
    data: Phaser.GameObjects.RetroFont.Parse(scene, {
      image: "font-ledger-image",
      "offset.x": 0,
      "offset.y": 0,
      width: cellWidth,
      height: cellHeight,
      chars,
      charsPerRow,
      "spacing.x": 0,
      "spacing.y": 0,
      lineSpacing: 0,
    }),
    texture: "font-ledger-image",
    fromAtlas: false,
  });
}

function drawProps(scene: Phaser.Scene) {
  drawAmbientProp(scene, "prop-pine", (ctx) => {
    fill(ctx, "#2b4337", 28, 48, 8, 22);
    fill(ctx, "#375a46", 14, 32, 36, 18);
    fill(ctx, "#4b7b63", 18, 16, 28, 18);
    fill(ctx, "#79ad90", 24, 10, 16, 10);
    outline(ctx, "#171813", 14, 10, 36, 40);
  });

  drawAmbientProp(scene, "prop-lamp", (ctx) => {
    fill(ctx, "#2f2b27", 29, 18, 6, 44);
    fill(ctx, "#5e7486", 23, 14, 18, 18);
    fill(ctx, "#ffe7a5", 25, 16, 14, 12);
    fill(ctx, "#7df0ff", 28, 18, 8, 4);
    outline(ctx, "#171813", 23, 14, 18, 18);
  });

  drawAmbientProp(scene, "prop-crate", (ctx) => {
    fill(ctx, "#5f4433", 14, 34, 36, 26);
    fill(ctx, "#8b6347", 18, 38, 28, 18);
    fill(ctx, "#c89a71", 18, 44, 28, 2);
    outline(ctx, "#171813", 14, 34, 36, 26);
  });

  drawAmbientProp(scene, "prop-banner", (ctx) => {
    fill(ctx, "#2a2520", 30, 12, 4, 50);
    fill(ctx, "#7df0ff", 34, 18, 18, 22);
    fill(ctx, "#f3f6ff", 38, 22, 10, 6);
    fill(ctx, "#f16f51", 34, 40, 10, 6);
  });

  drawAmbientProp(scene, "prop-reed", (ctx) => {
    fill(ctx, "#2c4a39", 18, 40, 4, 18);
    fill(ctx, "#3f6b51", 26, 34, 4, 24);
    fill(ctx, "#578867", 34, 38, 4, 20);
    fill(ctx, "#8bc0b1", 12, 56, 40, 6);
  });

  drawAmbientProp(scene, "prop-signpost", (ctx) => {
    fill(ctx, "#563f2f", 28, 24, 8, 38);
    fill(ctx, "#c1d8e6", 14, 14, 36, 16);
    fill(ctx, "#7df0ff", 18, 18, 16, 4);
    outline(ctx, "#171813", 14, 14, 36, 16);
  });

  drawAmbientProp(scene, "prop-stall", (ctx) => {
    fill(ctx, "#563f2f", 10, 48, 44, 14);
    fill(ctx, "#7a4f3c", 14, 30, 36, 18);
    fill(ctx, "#d3e0e8", 10, 22, 44, 8);
    fill(ctx, "#7df0ff", 16, 34, 10, 6);
    fill(ctx, "#ffb071", 34, 34, 10, 6);
    outline(ctx, "#171813", 10, 22, 44, 40);
  });

  drawAmbientProp(scene, "prop-statue", (ctx) => {
    fill(ctx, "#48505c", 22, 12, 20, 38);
    fill(ctx, "#7c8897", 24, 14, 16, 20);
    fill(ctx, "#5c6672", 16, 50, 32, 12);
    fill(ctx, "#7df0ff", 28, 26, 8, 4);
    outline(ctx, "#171813", 16, 12, 32, 50);
  });
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
    roof: buildingPalette.roofSlate,
    wall: "#67758a",
    banner: "#7df0ff",
    lamp: "#f0f6ff",
  });
  drawBuilding(scene, "building-forge", {
    roof: buildingPalette.roofCopper,
    wall: "#8e664f",
    banner: "#ffb071",
    lamp: "#ffd6aa",
  });
  drawBuilding(scene, "building-depot", {
    roof: "#4e6a79",
    wall: "#7b6951",
    banner: "#9dceff",
    lamp: "#e7f4ff",
  });
  drawBuilding(scene, "building-guild", {
    roof: "#5f5e71",
    wall: "#745c4c",
    banner: "#ffbcb0",
    lamp: "#fff1de",
  });
  drawBuilding(scene, "building-treasury", {
    roof: "#56625c",
    wall: "#77716d",
    banner: "#d8e4d2",
    lamp: "#eafced",
  });
  drawBuilding(scene, "building-council", {
    roof: "#4a5063",
    wall: "#7c7891",
    banner: "#cdbbff",
    lamp: "#f0ecff",
  });
  drawBuilding(scene, "building-keep-sovereign", {
    roof: "#c8a85c",
    wall: "#7f8a97",
    banner: "#dff8ff",
    lamp: "#fff6db",
  });
  drawBuilding(scene, "building-forge-sovereign", {
    roof: "#c99d5c",
    wall: "#7e8794",
    banner: "#ffd0a8",
    lamp: "#fff3d6",
  });
  drawBuilding(scene, "building-depot-sovereign", {
    roof: "#7d8897",
    wall: "#7e8794",
    banner: "#cfe3ff",
    lamp: "#f2fbff",
  });
  drawBuilding(scene, "building-guild-sovereign", {
    roof: "#7f8a97",
    wall: "#867b71",
    banner: "#ffd2c8",
    lamp: "#fff6e4",
  });
  drawBuilding(scene, "building-treasury-sovereign", {
    roof: "#c8a85c",
    wall: "#8a8479",
    banner: "#eff7da",
    lamp: "#fffbe3",
  });
  drawBuilding(scene, "building-council-sovereign", {
    roof: "#8a93a4",
    wall: "#9289a0",
    banner: "#e1d4ff",
    lamp: "#fff7ff",
  });

  drawInteriorProp(scene, "interior-forge", "#544034", "#927056", "#ffb071");
  drawInteriorProp(scene, "interior-depot", "#434c56", "#6f8192", "#b7d6e8");
  drawInteriorProp(scene, "interior-treasury", "#4f5147", "#7e7c63", "#dbe8cd");
  drawInteriorProp(scene, "interior-council", "#434051", "#706b86", "#cdbbff");

  drawProps(scene);
  drawSkillAltar(scene);
  drawVeritasScroll(scene);
  drawHearthFireFrame(scene, "fx-hearth-fire-0", {
    core: "#fff2b5",
    mid: "#ffb467",
    rim: "#ff6f4f",
  });
  drawHearthFireFrame(scene, "fx-hearth-fire-1", {
    core: "#fff6c5",
    mid: "#ffc26d",
    rim: "#ff8d55",
  });
  drawHearthFireFrame(scene, "fx-hearth-fire-2", {
    core: "#fff4be",
    mid: "#ffaf59",
    rim: "#ff5e49",
  });
  ensureGeneratedBitmapFonts(scene);

  drawFxTexture(scene, "fx-glow", "rgba(125,240,255,0.9)");
  drawFxTexture(scene, "fx-coin", "rgba(255,193,107,0.95)");
  drawFxTexture(scene, "fx-dust", "rgba(211, 220, 229, 0.65)");
  drawFxTexture(scene, "fx-agent-ring", "rgba(125,240,255,0.82)", 56);
  drawFxTexture(scene, "fx-human-ring", "rgba(255,197,128,0.7)", 56);
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
        frameRate: 7,
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
        frameRate: 6,
      });
    }
  });
}

export function registerGeneratedAnimations(scene: Phaser.Scene) {
  Object.keys(characterPalettes).forEach((characterId) => {
    registerCharacterAnimations(scene, characterId);
  });

  if (!scene.anims.exists("fx:hearth-fire")) {
    scene.anims.create({
      key: "fx:hearth-fire",
      frames: [
        { key: "fx-hearth-fire-0" },
        { key: "fx-hearth-fire-1" },
        { key: "fx-hearth-fire-2" },
      ],
      repeat: -1,
      frameRate: 7,
    });
  }
}
