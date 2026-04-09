import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

type TileLayer = {
  id: number;
  name: string;
  type: "tilelayer";
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  data: number[];
};

type ObjectProperty = {
  name: string;
  type: "string" | "bool" | "int";
  value: string | boolean | number;
};

type MapObject = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  visible: boolean;
  properties?: ObjectProperty[];
  point?: boolean;
};

type ObjectLayer = {
  id: number;
  name: string;
  type: "objectgroup";
  draworder: "topdown";
  opacity: number;
  visible: boolean;
  x: number;
  y: number;
  objects: MapObject[];
};

type TiledMap = {
  compressionlevel: number;
  height: number;
  infinite: boolean;
  layers: Array<TileLayer | ObjectLayer>;
  nextlayerid: number;
  nextobjectid: number;
  orientation: "orthogonal";
  renderorder: "right-down";
  tiledversion: string;
  tileheight: number;
  tilesets: Array<{
    columns: number;
    firstgid: number;
    image: string;
    imageheight: number;
    imagewidth: number;
    margin: number;
    name: string;
    spacing: number;
    tilecount: number;
    tileheight: number;
    tilewidth: number;
  }>;
  tilewidth: number;
  type: "map";
  version: string;
  width: number;
  properties: ObjectProperty[];
};

const TILE_SIZE = 32;
const OUTDOOR_TILESET = {
  columns: 8,
  tilecount: 24,
  tilewidth: TILE_SIZE,
  tileheight: TILE_SIZE,
  imagewidth: 256,
  imageheight: 96,
  image: "../assets/tilesets/bazaar-outdoor.png",
  name: "bazaar-outdoor",
  firstgid: 1,
  margin: 0,
  spacing: 0,
};

const INTERIOR_TILESET = {
  columns: 8,
  tilecount: 24,
  tilewidth: TILE_SIZE,
  tileheight: TILE_SIZE,
  imagewidth: 256,
  imageheight: 96,
  image: "../assets/tilesets/bazaar-interior.png",
  name: "bazaar-interior",
  firstgid: 1,
  margin: 0,
  spacing: 0,
};

function makeGrid(width: number, height: number, fill: number) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => fill));
}

function flatten(grid: number[][]) {
  return grid.flatMap((row) => row);
}

function paintRect(grid: number[][], x: number, y: number, width: number, height: number, value: number) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      if (grid[row]?.[col] !== undefined) {
        grid[row][col] = value;
      }
    }
  }
}

function paintAlternatingWater(grid: number[][], x: number, y: number, width: number, height: number) {
  for (let row = y; row < y + height; row += 1) {
    for (let col = x; col < x + width; col += 1) {
      if (grid[row]?.[col] !== undefined) {
        grid[row][col] = (row + col) % 2 === 0 ? 6 : 7;
      }
    }
  }
}

function addFlowers(grid: number[][], points: Array<[number, number]>) {
  points.forEach(([x, y], index) => {
    if (grid[y]?.[x] !== undefined) {
      grid[y][x] = index % 2 === 0 ? 2 : 14;
    }
  });
}

function createLayer(id: number, name: string, grid: number[][]): TileLayer {
  return {
    id,
    name,
    type: "tilelayer",
    width: grid[0]?.length ?? 0,
    height: grid.length,
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
    data: flatten(grid),
  };
}

function createObject(
  id: number,
  name: string,
  type: string,
  tileX: number,
  tileY: number,
  widthTiles = 1,
  heightTiles = 1,
  properties?: Record<string, string | boolean | number>,
): MapObject {
  return {
    id,
    name,
    type,
    x: tileX * TILE_SIZE,
    y: tileY * TILE_SIZE,
    width: widthTiles * TILE_SIZE,
    height: heightTiles * TILE_SIZE,
    rotation: 0,
    visible: true,
    properties: properties
      ? Object.entries(properties).map(([key, value]) => ({
          name: key,
          type: typeof value === "boolean" ? "bool" : typeof value === "number" ? "int" : "string",
          value,
        }))
      : undefined,
  };
}

function createPoint(
  id: number,
  name: string,
  type: string,
  tileX: number,
  tileY: number,
  properties?: Record<string, string | boolean | number>,
): MapObject {
  return {
    ...createObject(id, name, type, tileX, tileY, 0, 0, properties),
    point: true,
  };
}

function createObjectLayer(id: number, name: string, objects: MapObject[]): ObjectLayer {
  return {
    id,
    name,
    type: "objectgroup",
    draworder: "topdown",
    opacity: 1,
    visible: true,
    x: 0,
    y: 0,
    objects,
  };
}

function buildVillageMap() {
  const width = 30;
  const height = 22;
  const ground = makeGrid(width, height, 1);
  const details = makeGrid(width, height, 0);
  const collision = makeGrid(width, height, 0);

  paintAlternatingWater(ground, 0, 0, width, 2);
  paintAlternatingWater(ground, 0, 0, 3, height);
  paintRect(ground, 12, 0, 2, 4, 8);
  paintRect(ground, 4, 9, 22, 4, 3);
  paintRect(ground, 13, 2, 4, 18, 3);
  paintRect(ground, 10, 8, 10, 6, 5);
  addFlowers(details, [
    [5, 5],
    [6, 17],
    [20, 5],
    [25, 17],
    [8, 15],
    [22, 15],
  ]);

  const buildingRects = [
    [11, 2, 6, 3],
    [4, 5, 5, 4],
    [21, 5, 5, 4],
    [21, 14, 5, 3],
    [4, 15, 5, 4],
    [12, 15, 6, 4],
  ] as const;
  buildingRects.forEach(([x, y, widthTiles, heightTiles]) => {
    paintRect(collision, x, y, widthTiles, heightTiles, 16);
  });
  paintRect(collision, 0, 0, width, 2, 16);
  paintRect(collision, 0, 0, 3, height, 16);

  let objectId = 1;
  const interactables: MapObject[] = [
    createObject(objectId++, "keeper-gate", "interactable", 10, 6, 2, 2, {
      label: "Village Keeper",
      districtId: "village-gate",
      npcId: "keeper",
    }),
    createObject(objectId++, "settlement-keep", "interactable", 13, 5, 2, 1, {
      label: "Settlement Keep",
      districtId: "village-gate",
    }),
    createObject(objectId++, "forge-door", "interactable", 6, 9, 2, 1, {
      label: "Bazaar Forge",
      districtId: "market-row",
      portalId: "to-forge",
    }),
    createObject(objectId++, "depot-door", "interactable", 22, 9, 2, 1, {
      label: "Supply Coil Depot",
      districtId: "supplier-lane",
      portalId: "to-depot",
    }),
    createObject(objectId++, "guild-yard", "interactable", 22, 17, 2, 1, {
      label: "Node Pilot Yard",
      districtId: "worker-yard",
      npcId: "worker",
    }),
    createObject(objectId++, "treasury-door", "interactable", 5, 19, 2, 1, {
      label: "Treasury Vault",
      districtId: "treasury-vault",
      portalId: "to-treasury",
    }),
    createObject(objectId++, "council-door", "interactable", 14, 19, 2, 1, {
      label: "Covenant Hall",
      districtId: "council-hall",
      portalId: "to-council",
    }),
  ];

  const triggers: MapObject[] = [
    createObject(objectId++, "keeper-approach", "trigger", 9, 6, 3, 2),
    createObject(objectId++, "forge-portal", "trigger", 6, 10, 2, 1),
  ];

  const npcSpawns: MapObject[] = [
    createPoint(objectId++, "keeper", "spawn", 10.5, 7, { npcId: "keeper" }),
    createPoint(objectId++, "worker", "spawn", 23, 16.5, { npcId: "worker" }),
  ];

  const patrolNodes: MapObject[] = [
    createPoint(objectId++, "keeper-route-1", "path", 9.5, 7, { pathId: "keeper-route", order: 1 }),
    createPoint(objectId++, "keeper-route-2", "path", 14, 7, { pathId: "keeper-route", order: 2 }),
    createPoint(objectId++, "keeper-route-3", "path", 12.5, 11.5, { pathId: "keeper-route", order: 3 }),
    createPoint(objectId++, "worker-route-1", "path", 23, 16.5, { pathId: "worker-route", order: 1 }),
    createPoint(objectId++, "worker-route-2", "path", 18, 11, { pathId: "worker-route", order: 2 }),
    createPoint(objectId++, "worker-route-3", "path", 23, 11, { pathId: "worker-route", order: 3 }),
  ];

  const portals: MapObject[] = [
    createObject(objectId++, "to-forge", "portal", 6, 9, 2, 1, {
      targetMapId: "forge-interior",
      spawnId: "forge-entry",
    }),
    createObject(objectId++, "to-depot", "portal", 22, 9, 2, 1, {
      targetMapId: "depot-interior",
      spawnId: "depot-entry",
    }),
    createObject(objectId++, "to-treasury", "portal", 5, 19, 2, 1, {
      targetMapId: "treasury-interior",
      spawnId: "treasury-entry",
    }),
    createObject(objectId++, "to-council", "portal", 14, 19, 2, 1, {
      targetMapId: "council-interior",
      spawnId: "council-entry",
    }),
  ];

  return {
    compressionlevel: -1,
    height,
    infinite: false,
    layers: [
      createLayer(1, "ground", ground),
      createLayer(2, "details", details),
      createLayer(3, "collision", collision),
      createObjectLayer(4, "interactables", interactables),
      createObjectLayer(5, "triggers", triggers),
      createObjectLayer(6, "npcSpawns", npcSpawns),
      createObjectLayer(7, "patrolNodes", patrolNodes),
      createObjectLayer(8, "portals", portals),
    ],
    nextlayerid: 9,
    nextobjectid: objectId,
    orientation: "orthogonal" as const,
    renderorder: "right-down" as const,
    tiledversion: "1.11.0",
    tileheight: TILE_SIZE,
    tilesets: [OUTDOOR_TILESET],
    tilewidth: TILE_SIZE,
    type: "map" as const,
    version: "1.10",
    width,
    properties: [{ name: "mapId", type: "string", value: "village-exterior" }],
  } satisfies TiledMap;
}

function buildInteriorMap(config: {
  mapId: string;
  roomTile: number;
  npcId: string;
  npcSpawn: [number, number];
  interactableName: string;
  interactableNpcId: string;
  exitTo: string;
}) {
  const width = 18;
  const height = 14;
  const ground = makeGrid(width, height, config.roomTile);
  const details = makeGrid(width, height, 0);
  const collision = makeGrid(width, height, 0);

  paintRect(collision, 0, 0, width, 1, 16);
  paintRect(collision, 0, height - 1, width, 1, 16);
  paintRect(collision, 0, 0, 1, height, 16);
  paintRect(collision, width - 1, 0, 1, height, 16);
  paintRect(collision, 6, 3, 6, 1, 16);
  paintRect(collision, 6, 3, 1, 3, 16);
  paintRect(collision, 11, 3, 1, 3, 16);
  paintRect(details, 2, 2, 2, 2, 15);
  paintRect(details, 13, 2, 2, 2, 15);

  let objectId = 1;
  const interactables: MapObject[] = [
    createObject(objectId++, config.interactableName, "interactable", 8, 5, 2, 1, {
      npcId: config.interactableNpcId,
      label: config.interactableName,
    }),
  ];
  const npcSpawns: MapObject[] = [
    createPoint(objectId++, config.npcId, "spawn", config.npcSpawn[0], config.npcSpawn[1], {
      npcId: config.npcId,
    }),
  ];
  const patrolNodes: MapObject[] = [
    createPoint(objectId++, `${config.npcId}-loop-1`, "path", config.npcSpawn[0], config.npcSpawn[1], {
      pathId: `${config.npcId}-loop`,
      order: 1,
    }),
    createPoint(objectId++, `${config.npcId}-loop-2`, "path", config.npcSpawn[0] + 2, config.npcSpawn[1], {
      pathId: `${config.npcId}-loop`,
      order: 2,
    }),
    createPoint(objectId++, `${config.npcId}-loop-3`, "path", config.npcSpawn[0] + 1, config.npcSpawn[1] + 2, {
      pathId: `${config.npcId}-loop`,
      order: 3,
    }),
  ];
  const portals: MapObject[] = [
    createObject(objectId++, `${config.mapId}-exit`, "portal", 8, 12, 2, 1, {
      targetMapId: "village-exterior",
      spawnId: config.exitTo,
    }),
  ];

  return {
    compressionlevel: -1,
    height,
    infinite: false,
    layers: [
      createLayer(1, "ground", ground),
      createLayer(2, "details", details),
      createLayer(3, "collision", collision),
      createObjectLayer(4, "interactables", interactables),
      createObjectLayer(5, "triggers", []),
      createObjectLayer(6, "npcSpawns", npcSpawns),
      createObjectLayer(7, "patrolNodes", patrolNodes),
      createObjectLayer(8, "portals", portals),
    ],
    nextlayerid: 9,
    nextobjectid: objectId,
    orientation: "orthogonal" as const,
    renderorder: "right-down" as const,
    tiledversion: "1.11.0",
    tileheight: TILE_SIZE,
    tilesets: [INTERIOR_TILESET],
    tilewidth: TILE_SIZE,
    type: "map" as const,
    version: "1.10",
    width,
    properties: [{ name: "mapId", type: "string", value: config.mapId }],
  } satisfies TiledMap;
}

async function writeJson(path: string, payload: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(payload, null, 2));
}

async function main() {
  const base = resolve(process.cwd(), "game/maps/tiled");

  await writeJson(resolve(base, "village-exterior.json"), buildVillageMap());
  await writeJson(
    resolve(base, "forge-interior.json"),
    buildInteriorMap({
      mapId: "forge-interior",
      roomTile: 11,
      npcId: "shopkeeper",
      npcSpawn: [8.5, 8],
      interactableName: "forge-board",
      interactableNpcId: "shopkeeper",
      exitTo: "forge-return",
    }),
  );
  await writeJson(
    resolve(base, "depot-interior.json"),
    buildInteriorMap({
      mapId: "depot-interior",
      roomTile: 9,
      npcId: "supplier",
      npcSpawn: [8.5, 8],
      interactableName: "supplier-desk",
      interactableNpcId: "supplier",
      exitTo: "depot-return",
    }),
  );
  await writeJson(
    resolve(base, "treasury-interior.json"),
    buildInteriorMap({
      mapId: "treasury-interior",
      roomTile: 12,
      npcId: "treasurer",
      npcSpawn: [8.5, 8],
      interactableName: "treasury-board",
      interactableNpcId: "treasurer",
      exitTo: "treasury-return",
    }),
  );
  await writeJson(
    resolve(base, "council-interior.json"),
    buildInteriorMap({
      mapId: "council-interior",
      roomTile: 13,
      npcId: "governor",
      npcSpawn: [8.5, 8],
      interactableName: "governor-dais",
      interactableNpcId: "governor",
      exitTo: "council-return",
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

