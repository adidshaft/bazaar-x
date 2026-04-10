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

function drawOutdoorTiles(scene: Phaser.Scene) {
  const texture = withCanvasTexture(scene, "bazaar-outdoor", 256, 96);
  if (!texture) {
    return;
  }

  const ctx = texture.context;
  const tileSize = 32;
  const palette = {
    grass: "#486a56",
    moss: "#31483b",
    meadow: "#5a836b",
    road: "#7b7065",
    dirt: "#5a4b40",
    plaza: "#c6d0d8",
    plazaShade: "#98a7b1",
    waterA: "#24566f",
    waterB: "#2e718e",
    bridge: "#675240",
    border: "#1b1815",
    flower: "#c7d6e2",
    lantern: "#f4d7a0",
  };

  for (let index = 0; index < 24; index += 1) {
    const x = (index % 8) * tileSize;
    const y = Math.floor(index / 8) * tileSize;
    fill(ctx, palette.grass, x, y, tileSize, tileSize);
    fill(ctx, palette.moss, x, y + 22, tileSize, 10);
  }

  fill(ctx, palette.grass, 0, 0, tileSize, tileSize);
  fill(ctx, palette.meadow, 3, 3, 10, 8);
  fill(ctx, palette.moss, 18, 12, 10, 10);

  fill(ctx, palette.grass, 32, 0, tileSize, tileSize);
  fill(ctx, palette.flower, 7 + 32, 7, 5, 5);
  fill(ctx, "#9de0d9", 22 + 32, 16, 4, 4);
  fill(ctx, "#f0f7fb", 16 + 32, 23, 4, 4);

  fill(ctx, palette.road, 64, 0, tileSize, tileSize);
  fill(ctx, palette.dirt, 64, 22, tileSize, 10);
  fill(ctx, "#8f8378", 70, 6, 18, 3);
  fill(ctx, "#64564a", 66, 14, 22, 4);

  fill(ctx, palette.road, 96, 0, tileSize, tileSize);
  fill(ctx, palette.plaza, 96, 0, 6, tileSize);
  fill(ctx, palette.dirt, 96, 22, tileSize, 10);

  fill(ctx, palette.plaza, 128, 0, tileSize, tileSize);
  fill(ctx, palette.plazaShade, 132, 4, 10, 10);
  fill(ctx, "#e8eff4", 148, 16, 9, 9);
  outline(ctx, "rgba(27,24,21,0.18)", 128, 0, tileSize, tileSize);

  fill(ctx, palette.waterA, 160, 0, tileSize, tileSize);
  fill(ctx, "#60a6c1", 164, 8, 24, 3);
  fill(ctx, "#aee7f2", 170, 17, 14, 2);

  fill(ctx, palette.waterB, 192, 0, tileSize, tileSize);
  fill(ctx, "#6fc6e0", 196, 12, 18, 3);
  fill(ctx, "#d8fbff", 205, 20, 10, 2);

  fill(ctx, palette.bridge, 224, 0, tileSize, tileSize);
  fill(ctx, "#94745a", 224, 6, tileSize, 6);
  fill(ctx, "#4a3a2e", 224, 17, tileSize, 4);

  fill(ctx, "#58606a", 0, 32, tileSize, tileSize);
  fill(ctx, "#88939e", 4, 4, 24, 24);
  fill(ctx, "#c9d4dd", 8, 8, 16, 6);

  fill(ctx, "#4f5a53", 32, 32, tileSize, tileSize);
  fill(ctx, "#7a897d", 36, 6, 24, 20);

  fill(ctx, palette.lantern, 64, 32, tileSize, tileSize);
  fill(ctx, "#fff2be", 72, 8, 16, 16);
  fill(ctx, "#75ddf0", 76, 12, 8, 4);
  outline(ctx, palette.border, 64, 32, tileSize, tileSize);

  fill(ctx, "#355342", 96, 32, tileSize, tileSize);
  fill(ctx, "#20372d", 100, 20, 24, 8);

  fill(ctx, "#7d5a47", 128, 32, tileSize, tileSize);
  fill(ctx, "#c89e78", 132, 4, 24, 14);
  fill(ctx, "#f3e2c8", 136, 8, 16, 4);

  fill(ctx, "#505760", 160, 32, tileSize, tileSize);
  fill(ctx, "#8e9aa7", 166, 8, 20, 18);

  fill(ctx, "#77928b", 192, 32, tileSize, tileSize);
  fill(ctx, "#e8fbff", 197, 9, 4, 4);
  fill(ctx, "#d4e9f2", 210, 17, 5, 5);

  fill(ctx, "#4a3d33", 224, 32, tileSize, tileSize);
  fill(ctx, "#8d7865", 228, 6, 24, 12);
  fill(ctx, "#d1c5b9", 234, 10, 14, 4);

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
    "#4f4136",
    "#39454e",
    "#59515d",
    "#585954",
    "#6b5d4f",
    "#304851",
    "#5d5348",
    "#49443f",
    "#716658",
    "#5b5146",
    "#56453a",
    "#5b6358",
    "#666763",
    "#494d63",
  ];

  colors.forEach((color, index) => {
    const x = (index % 8) * tileSize;
    const y = Math.floor(index / 8) * tileSize;
    fill(ctx, color, x, y, tileSize, tileSize);
    fill(ctx, "rgba(255,255,255,0.08)", x, y, tileSize, 4);
    fill(ctx, "rgba(0,0,0,0.14)", x, y + 24, tileSize, 8);
  });

  fill(ctx, "#c2d2db", 224, 32, tileSize, tileSize);
  fill(ctx, "#718899", 228, 10, 22, 12);
  fill(ctx, "#7df0ff", 236, 14, 8, 4);
  outline(ctx, "#1b1815", 224, 32, tileSize, tileSize);

  texture.refresh();
}

export function ensureGeneratedTileTextures(scene: Phaser.Scene) {
  drawOutdoorTiles(scene);
  drawInteriorTiles(scene);
}
