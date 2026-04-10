import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type TiledLayer =
  | {
      id: number;
      name: string;
      type: "tilelayer";
      data: number[];
      visible: boolean;
    }
  | {
      id: number;
      name: string;
      type: "objectgroup";
      objects: Array<{
        id: number;
        name: string;
        type: string;
        x: number;
        y: number;
        width: number;
        height: number;
        point?: boolean;
        properties?: Array<{ name: string; value: string | boolean | number }>;
      }>;
      visible: boolean;
    };

type TiledMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TiledLayer[];
  properties?: Array<{ name: string; value: string | boolean | number }>;
};

const REQUIRED_LAYERS = [
  "ground",
  "details",
  "collision",
  "interactables",
  "triggers",
  "npcSpawns",
  "patrolNodes",
  "portals",
  "ambientProps",
] as const;

function getMapId(map: TiledMap) {
  const mapId = map.properties?.find((property) => property.name === "mapId")?.value;
  if (!mapId || typeof mapId !== "string") {
    throw new Error("Map is missing mapId property.");
  }
  return mapId;
}

function normalizeObjectLayer(
  layer: Extract<TiledLayer, { type: "objectgroup" }>,
  tilewidth: number,
  tileheight: number,
) {
  return layer.objects.map((object) => ({
    id: object.id,
    name: object.name,
    type: object.type,
    x: object.x,
    y: object.y,
    tileX: object.x / tilewidth,
    tileY: object.y / tileheight,
    width: object.width,
    height: object.height,
    widthTiles: object.width / tilewidth,
    heightTiles: object.height / tileheight,
    point: Boolean(object.point),
    properties: Object.fromEntries(
      (object.properties ?? []).map((property) => [property.name, property.value]),
    ),
  }));
}

async function main() {
  const tiledDir = resolve(process.cwd(), "game/maps/tiled");
  const compiledDir = resolve(process.cwd(), "game/maps/compiled");
  await mkdir(compiledDir, { recursive: true });

  const files = (await readdir(tiledDir)).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    const sourcePath = resolve(tiledDir, file);
    const raw = await readFile(sourcePath, "utf8");
    const map = JSON.parse(raw) as TiledMap;

    for (const layerName of REQUIRED_LAYERS) {
      if (!map.layers.some((layer) => layer.name === layerName)) {
        throw new Error(`${file} is missing required layer "${layerName}".`);
      }
    }

    const compiled = {
      ...map,
      bazaarx: {
        mapId: getMapId(map),
        collisionLayer: "collision",
        renderLayers: ["ground", "details"],
        objectLayers: Object.fromEntries(
          map.layers
            .filter(
              (layer): layer is Extract<TiledLayer, { type: "objectgroup" }> => layer.type === "objectgroup",
            )
            .map((layer) => [layer.name, normalizeObjectLayer(layer, map.tilewidth, map.tileheight)]),
        ),
      },
    };

    await writeFile(resolve(compiledDir, file), JSON.stringify(compiled, null, 2));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
