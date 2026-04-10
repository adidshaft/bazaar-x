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
      grid[y][x] = index % 2 === 0 ? 2 : 19;
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
  const width = 58;
  const height = 38;
  const ground = makeGrid(width, height, 1);
  const details = makeGrid(width, height, 0);
  const collision = makeGrid(width, height, 0);

  paintAlternatingWater(ground, 27, 0, 4, height);
  paintAlternatingWater(ground, 0, 0, width, 2);
  paintRect(ground, 4, 17, 50, 4, 3);
  paintRect(ground, 28, 3, 2, 31, 3);
  paintRect(ground, 22, 13, 14, 12, 5);
  paintRect(ground, 27, 17, 4, 4, 8);
  paintRect(ground, 24, 9, 10, 4, 5);
  paintRect(ground, 10, 13, 8, 5, 3);
  paintRect(ground, 42, 13, 10, 5, 3);
  paintRect(ground, 44, 25, 8, 4, 3);
  paintRect(ground, 8, 26, 8, 4, 3);
  paintRect(ground, 26, 27, 10, 4, 3);
  paintRect(ground, 8, 29, 8, 5, 5);
  paintRect(ground, 26, 30, 10, 5, 5);
  paintRect(ground, 44, 29, 9, 4, 5);
  paintRect(ground, 8, 11, 8, 5, 5);
  paintRect(ground, 44, 11, 8, 5, 5);
  paintRect(ground, 26, 4, 8, 5, 5);
  paintRect(ground, 0, 35, width, 3, 4);

  addFlowers(details, [
    [6, 6],
    [9, 24],
    [18, 6],
    [40, 7],
    [49, 8],
    [8, 33],
    [39, 32],
    [54, 27],
    [21, 32],
    [15, 23],
    [33, 8],
    [35, 28],
  ]);

  paintRect(collision, 27, 0, 4, height, 16);
  paintRect(collision, 0, 0, width, 2, 16);
  paintRect(collision, 0, 0, 2, height, 16);
  paintRect(collision, width - 2, 0, 2, height, 16);
  paintRect(collision, 0, height - 2, width, 2, 16);

  const buildingRects = [
    [26, 4, 8, 5],
    [8, 11, 8, 6],
    [44, 11, 8, 6],
    [44, 28, 9, 5],
    [8, 29, 8, 6],
    [26, 30, 10, 5],
  ] as const;

  buildingRects.forEach(([x, y, widthTiles, heightTiles]) => {
    paintRect(collision, x, y, widthTiles, heightTiles, 16);
  });

  let objectId = 1;
  const interactables: MapObject[] = [
    createObject(objectId++, "keeper-gate", "interactable", 24, 10, 2, 2, {
      label: "Village Keeper",
      districtId: "village-gate",
      npcId: "keeper",
    }),
    createObject(objectId++, "settlement-keep", "interactable", 29, 9, 2, 1, {
      label: "Settlement Keep",
      districtId: "village-gate",
    }),
    createObject(objectId++, "forge-door", "interactable", 11, 17, 2, 1, {
      label: "Bazaar Forge",
      districtId: "market-row",
      portalId: "to-forge",
    }),
    createObject(objectId++, "depot-door", "interactable", 47, 17, 2, 1, {
      label: "Supply Coil Depot",
      districtId: "supplier-lane",
      portalId: "to-depot",
    }),
    createObject(objectId++, "guild-yard", "interactable", 47, 32, 2, 1, {
      label: "Node Pilot Yard",
      districtId: "worker-yard",
      npcId: "worker",
    }),
    createObject(objectId++, "treasury-door", "interactable", 11, 35, 2, 1, {
      label: "Treasury Vault",
      districtId: "treasury-vault",
      portalId: "to-treasury",
    }),
    createObject(objectId++, "council-door", "interactable", 30, 35, 2, 1, {
      label: "Covenant Hall",
      districtId: "council-hall",
      portalId: "to-council",
    }),
  ];

  const triggers: MapObject[] = [
    createObject(objectId++, "keeper-approach", "trigger", 23, 10, 4, 2),
    createObject(objectId++, "forge-portal", "trigger", 11, 18, 2, 1),
    createObject(objectId++, "depot-portal", "trigger", 47, 18, 2, 1),
  ];

  const npcSpawns: MapObject[] = [
    createPoint(objectId++, "keeper", "spawn", 25.5, 11.2, { npcId: "keeper" }),
    createPoint(objectId++, "worker", "spawn", 48.5, 31.5, { npcId: "worker" }),
  ];

  const patrolNodes: MapObject[] = [
    createPoint(objectId++, "keeper-route-1", "path", 25.5, 11.2, { pathId: "keeper-route", order: 1 }),
    createPoint(objectId++, "keeper-route-2", "path", 20, 18.5, { pathId: "keeper-route", order: 2 }),
    createPoint(objectId++, "keeper-route-3", "path", 30, 20, { pathId: "keeper-route", order: 3 }),
    createPoint(objectId++, "keeper-route-4", "path", 33.5, 14.5, { pathId: "keeper-route", order: 4 }),
    createPoint(objectId++, "worker-route-1", "path", 48.5, 31.5, { pathId: "worker-route", order: 1 }),
    createPoint(objectId++, "worker-route-2", "path", 45, 24, { pathId: "worker-route", order: 2 }),
    createPoint(objectId++, "worker-route-3", "path", 38, 18.5, { pathId: "worker-route", order: 3 }),
    createPoint(objectId++, "worker-route-4", "path", 48, 18.5, { pathId: "worker-route", order: 4 }),
  ];

  const portals: MapObject[] = [
    createObject(objectId++, "to-forge", "portal", 11, 17, 2, 1, {
      targetMapId: "forge-interior",
      spawnId: "forge-entry",
    }),
    createObject(objectId++, "to-depot", "portal", 47, 17, 2, 1, {
      targetMapId: "depot-interior",
      spawnId: "depot-entry",
    }),
    createObject(objectId++, "to-treasury", "portal", 11, 35, 2, 1, {
      targetMapId: "treasury-interior",
      spawnId: "treasury-entry",
    }),
    createObject(objectId++, "to-council", "portal", 30, 35, 2, 1, {
      targetMapId: "council-interior",
      spawnId: "council-entry",
    }),
  ];

  const ambientProps: MapObject[] = [
    ...[
      [5, 7],
      [8, 5],
      [14, 6],
      [36, 6],
      [41, 8],
      [52, 6],
      [6, 24],
      [16, 24],
      [39, 25],
      [54, 25],
      [18, 33],
      [40, 34],
      [51, 34],
    ].map(([x, y], index) =>
      createPoint(objectId + index, `pine-${index + 1}`, "ambient", x, y, {
        kind: "pine",
        scale: index % 3 === 0 ? 12 : 10,
      }),
    ),
  ];
  objectId += 13;

  ambientProps.push(
    ...[
      [9, 18],
      [18, 18],
      [24, 18],
      [35, 18],
      [42, 18],
      [50, 18],
      [29, 10],
      [12, 35],
      [31, 35],
    ].map(([x, y], index) =>
      createPoint(objectId + index, `lamp-${index + 1}`, "ambient", x, y, {
        kind: "lamp",
      }),
    ),
  );
  objectId += 9;

  ambientProps.push(
    createPoint(objectId++, "forge-stall", "ambient", 16, 15, { kind: "stall" }),
    createPoint(objectId++, "depot-stall", "ambient", 42, 15, { kind: "stall" }),
    createPoint(objectId++, "north-banner", "ambient", 29, 7, { kind: "banner" }),
    createPoint(objectId++, "south-banner", "ambient", 31, 32, { kind: "banner" }),
    createPoint(objectId++, "plaza-statue", "ambient", 28.5, 19, { kind: "statue" }),
    createPoint(objectId++, "west-signpost", "ambient", 18, 18, { kind: "signpost" }),
    createPoint(objectId++, "east-signpost", "ambient", 40, 18, { kind: "signpost" }),
    createPoint(objectId++, "crate-stack-1", "ambient", 44, 20, { kind: "crate" }),
    createPoint(objectId++, "crate-stack-2", "ambient", 16, 20, { kind: "crate" }),
    createPoint(objectId++, "reed-bank-1", "ambient", 25, 8, { kind: "reed" }),
    createPoint(objectId++, "reed-bank-2", "ambient", 32, 28, { kind: "reed" }),
    createPoint(objectId++, "gate-banner-west", "ambient", 24, 9, { kind: "banner" }),
    createPoint(objectId++, "gate-banner-east", "ambient", 34, 9, { kind: "banner" }),
    createPoint(objectId++, "gate-crate-west", "ambient", 22.5, 13.5, { kind: "crate" }),
    createPoint(objectId++, "gate-crate-east", "ambient", 35.5, 13.5, { kind: "crate" }),
    createPoint(objectId++, "gate-lamp-west", "ambient", 23, 11.5, { kind: "lamp" }),
    createPoint(objectId++, "gate-lamp-east", "ambient", 34, 11.5, { kind: "lamp" }),
    createPoint(objectId++, "gate-pine-west", "ambient", 20, 14, { kind: "pine", scale: 11 }),
    createPoint(objectId++, "gate-pine-east", "ambient", 38, 14, { kind: "pine", scale: 11 }),
  );

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
      createObjectLayer(9, "ambientProps", ambientProps),
    ],
    nextlayerid: 10,
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
  props: Array<{ kind: string; x: number; y: number; scale?: number }>;
}) {
  const width = 26;
  const height = 18;
  const ground = makeGrid(width, height, config.roomTile);
  const details = makeGrid(width, height, 0);
  const collision = makeGrid(width, height, 0);

  paintRect(collision, 0, 0, width, 1, 16);
  paintRect(collision, 0, height - 1, width, 1, 16);
  paintRect(collision, 0, 0, 1, height, 16);
  paintRect(collision, width - 1, 0, 1, height, 16);
  paintRect(collision, 7, 3, 12, 1, 16);
  paintRect(collision, 7, 3, 1, 4, 16);
  paintRect(collision, 18, 3, 1, 4, 16);
  paintRect(collision, 5, 11, 16, 1, 16);

  paintRect(details, 3, 3, 3, 3, 15);
  paintRect(details, 20, 3, 3, 3, 15);
  paintRect(details, 9, 8, 8, 2, 14);

  let objectId = 1;
  const interactables: MapObject[] = [
    createObject(objectId++, config.interactableName, "interactable", 12, 6, 2, 1, {
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
    createPoint(objectId++, `${config.npcId}-loop-2`, "path", config.npcSpawn[0] + 3, config.npcSpawn[1], {
      pathId: `${config.npcId}-loop`,
      order: 2,
    }),
    createPoint(objectId++, `${config.npcId}-loop-3`, "path", config.npcSpawn[0] + 1.5, config.npcSpawn[1] + 2.5, {
      pathId: `${config.npcId}-loop`,
      order: 3,
    }),
  ];
  const portals: MapObject[] = [
    createObject(objectId++, `${config.mapId}-exit`, "portal", 12, 16, 2, 1, {
      targetMapId: "village-exterior",
      spawnId: config.exitTo,
    }),
  ];
  const ambientProps = config.props.map((prop, index) =>
    createPoint(objectId + index, `${config.mapId}-prop-${index + 1}`, "ambient", prop.x, prop.y, {
      kind: prop.kind,
      scale: prop.scale ?? 10,
    }),
  );
  objectId += ambientProps.length;

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
      createObjectLayer(9, "ambientProps", ambientProps),
    ],
    nextlayerid: 10,
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
      npcSpawn: [12.5, 10],
      interactableName: "forge-board",
      interactableNpcId: "shopkeeper",
      exitTo: "forge-return",
      props: [
        { kind: "banner", x: 6, y: 4 },
        { kind: "stall", x: 20, y: 5 },
        { kind: "crate", x: 6, y: 12 },
      ],
    }),
  );
  await writeJson(
    resolve(base, "depot-interior.json"),
    buildInteriorMap({
      mapId: "depot-interior",
      roomTile: 9,
      npcId: "supplier",
      npcSpawn: [12.5, 10],
      interactableName: "supplier-desk",
      interactableNpcId: "supplier",
      exitTo: "depot-return",
      props: [
        { kind: "crate", x: 5, y: 5 },
        { kind: "crate", x: 20, y: 5 },
        { kind: "banner", x: 13, y: 4 },
      ],
    }),
  );
  await writeJson(
    resolve(base, "treasury-interior.json"),
    buildInteriorMap({
      mapId: "treasury-interior",
      roomTile: 12,
      npcId: "treasurer",
      npcSpawn: [12.5, 10],
      interactableName: "treasury-board",
      interactableNpcId: "treasurer",
      exitTo: "treasury-return",
      props: [
        { kind: "lamp", x: 6, y: 5 },
        { kind: "lamp", x: 20, y: 5 },
        { kind: "statue", x: 13, y: 4 },
      ],
    }),
  );
  await writeJson(
    resolve(base, "council-interior.json"),
    buildInteriorMap({
      mapId: "council-interior",
      roomTile: 13,
      npcId: "governor",
      npcSpawn: [12.5, 10],
      interactableName: "governor-dais",
      interactableNpcId: "governor",
      exitTo: "council-return",
      props: [
        { kind: "banner", x: 7, y: 4 },
        { kind: "banner", x: 18, y: 4 },
        { kind: "statue", x: 13, y: 5 },
      ],
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
