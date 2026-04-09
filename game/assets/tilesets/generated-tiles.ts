import * as Phaser from "phaser";

function withCanvasTexture(scene: Phaser.Scene, key: string, width: number, height: number) {
  const existing = scene.textures.get(key);
  if (existing && existing.key !== "__MISSING") {
    return null;
  }

  const texture = scene.textures.createCanvas(key, width, height);
  if (!texture) {
    return null;
  }
  const context = texture.context as CanvasRenderingContext2D;
  context.imageSmoothingEnabled = false;
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

function drawOutdoorTiles(scene: Phaser.Scene) {
  const texture = withCanvasTexture(scene, "bazaar-outdoor", 256, 96);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  const tileSize = 32;
  const palette = {
    grass: "#7ca95d",
    moss: "#6a9250",
    road: "#b48c61",
    dirt: "#8e643f",
    stone: "#d4c4a4",
    waterA: "#3f8fc1",
    waterB: "#58a9d3",
    bridge: "#8f6941",
    border: "#2f2319",
    flower: "#f3cc7d",
    lantern: "#f6d67b",
  };

  for (let index = 0; index < 24; index += 1) {
    const x = (index % 8) * tileSize;
    const y = Math.floor(index / 8) * tileSize;
    fill(ctx, palette.grass, x, y, tileSize, tileSize);
    fill(ctx, palette.moss, x, y + 22, tileSize, 10);
  }

  fill(ctx, palette.grass, 0, 0, tileSize, tileSize);
  fill(ctx, "#89b967", 4, 4, 8, 8);
  fill(ctx, "#6e9650", 18, 10, 10, 10);

  fill(ctx, palette.grass, 32, 0, tileSize, tileSize);
  fill(ctx, palette.flower, 7, 7, 5, 5);
  fill(ctx, palette.flower, 22 + 32, 16, 4, 4);

  fill(ctx, palette.road, 64, 0, tileSize, tileSize);
  fill(ctx, palette.dirt, 64, 22, tileSize, 10);
  outline(ctx, "rgba(47,35,25,0.24)", 64, 0, tileSize, tileSize);

  fill(ctx, palette.road, 96, 0, tileSize, tileSize);
  fill(ctx, palette.stone, 96, 0, 6, tileSize);
  fill(ctx, palette.dirt, 96, 22, tileSize, 10);

  fill(ctx, palette.stone, 128, 0, tileSize, tileSize);
  fill(ctx, "#c6b18e", 132, 4, 10, 10);
  fill(ctx, "#e0d3b8", 148, 16, 9, 9);

  fill(ctx, palette.waterA, 160, 0, tileSize, tileSize);
  fill(ctx, "#89d5f1", 164, 8, 24, 3);
  fill(ctx, "#d2f3ff", 170, 17, 14, 2);

  fill(ctx, palette.waterB, 192, 0, tileSize, tileSize);
  fill(ctx, "#9ae3ff", 196, 12, 18, 3);
  fill(ctx, "#d7fbff", 205, 20, 10, 2);

  fill(ctx, palette.bridge, 224, 0, tileSize, tileSize);
  fill(ctx, "#af875c", 224, 6, tileSize, 6);
  fill(ctx, "#6c4f31", 224, 17, tileSize, 4);

  fill(ctx, "#7d5a39", 0, 32, tileSize, tileSize);
  fill(ctx, "#a97b4d", 4, 4, 24, 24);

  fill(ctx, "#8b9187", 32, 32, tileSize, tileSize);
  fill(ctx, "#b0b7ab", 36, 6, 24, 20);

  fill(ctx, palette.lantern, 64, 32, tileSize, tileSize);
  fill(ctx, "#fff2a1", 72, 8, 16, 16);
  outline(ctx, palette.border, 64, 32, tileSize, tileSize);

  fill(ctx, "#5b7d47", 96, 32, tileSize, tileSize);
  fill(ctx, "#3e5a31", 100, 20, 24, 8);

  fill(ctx, "#b56d49", 128, 32, tileSize, tileSize);
  fill(ctx, "#efba77", 132, 4, 24, 14);

  fill(ctx, "#6f5638", 160, 32, tileSize, tileSize);
  fill(ctx, "#bca26e", 166, 8, 20, 18);

  fill(ctx, "#b8d584", 192, 32, tileSize, tileSize);
  fill(ctx, "#f1ebc6", 197, 9, 4, 4);
  fill(ctx, "#f1ebc6", 210, 17, 5, 5);

  fill(ctx, "#563d2b", 224, 32, tileSize, tileSize);
  fill(ctx, "#c58c5b", 228, 6, 24, 12);

  texture.refresh();
}

function drawInteriorTiles(scene: Phaser.Scene) {
  const texture = withCanvasTexture(scene, "bazaar-interior", 256, 96);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  const tileSize = 32;

  const colors = [
    "#835c3c",
    "#6d4b31",
    "#5e4638",
    "#7b6554",
    "#8c734f",
    "#4c5961",
    "#6a5850",
    "#493f37",
    "#927a60",
    "#6d5944",
    "#70513a",
    "#7a6b52",
    "#6d6558",
    "#59586c",
  ];

  colors.forEach((color, index) => {
    const x = (index % 8) * tileSize;
    const y = Math.floor(index / 8) * tileSize;
    fill(ctx, color, x, y, tileSize, tileSize);
    fill(ctx, "rgba(255,255,255,0.08)", x, y, tileSize, 4);
    fill(ctx, "rgba(0,0,0,0.12)", x, y + 24, tileSize, 8);
  });

  fill(ctx, "#dcbf8f", 224, 32, tileSize, tileSize);
  fill(ctx, "#8d6d47", 228, 10, 22, 12);
  outline(ctx, "#2f2319", 224, 32, tileSize, tileSize);

  texture.refresh();
}

export function ensureGeneratedTileTextures(scene: Phaser.Scene) {
  drawOutdoorTiles(scene);
  drawInteriorTiles(scene);
}
