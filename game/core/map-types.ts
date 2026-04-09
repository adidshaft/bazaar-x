import type { MapId } from "./live-types";

export type CompiledMapObject = {
  id: number;
  name: string;
  type: string;
  x: number;
  y: number;
  tileX: number;
  tileY: number;
  width: number;
  height: number;
  widthTiles: number;
  heightTiles: number;
  point: boolean;
  properties: Record<string, string | boolean | number>;
};

export type CompiledMapJson = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: Array<{
    id: number;
    name: string;
    type: string;
    width?: number;
    height?: number;
    data?: number[];
    visible?: boolean;
  }>;
  tilesets: Array<{
    firstgid: number;
    name: string;
    tilewidth: number;
    tileheight: number;
    tilecount: number;
    columns: number;
  }>;
  bazaarx: {
    mapId: MapId;
    collisionLayer: string;
    renderLayers: string[];
    objectLayers: Record<string, CompiledMapObject[]>;
  };
};

