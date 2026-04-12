export type GridPoint = {
  x: number;
  y: number;
};

type SearchNode = GridPoint & {
  g: number;
  h: number;
  f: number;
  parent?: string;
};

function pointKey(point: GridPoint) {
  return `${point.x},${point.y}`;
}

function heuristic(left: GridPoint, right: GridPoint) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

export function resolveNearestWalkable(grid: boolean[][], point: GridPoint) {
  if (grid[point.y]?.[point.x]) {
    return point;
  }

  for (let radius = 1; radius <= 8; radius += 1) {
    for (let y = point.y - radius; y <= point.y + radius; y += 1) {
      for (let x = point.x - radius; x <= point.x + radius; x += 1) {
        if (grid[y]?.[x]) {
          return { x, y };
        }
      }
    }
  }

  return point;
}

export function findGridPath(grid: boolean[][], start: GridPoint, target: GridPoint) {
  const origin = resolveNearestWalkable(grid, start);
  const goal = resolveNearestWalkable(grid, target);

  const open = new Map<string, SearchNode>();
  const visited = new Map<string, SearchNode>();
  const closed = new Set<string>();

  const originNode = {
    ...origin,
    g: 0,
    h: heuristic(origin, goal),
    f: heuristic(origin, goal),
  } satisfies SearchNode;
  open.set(pointKey(origin), originNode);
  visited.set(pointKey(origin), originNode);

  while (open.size > 0) {
    const current = [...open.values()].sort((left, right) => left.f - right.f)[0];
    if (!current) {
      break;
    }

    const currentKey = pointKey(current);
    open.delete(currentKey);

    if (current.x === goal.x && current.y === goal.y) {
      const path: GridPoint[] = [goal];
      let cursor = current;

      while (cursor.parent) {
        const [x, y] = cursor.parent.split(",").map(Number);
        path.push({ x, y });
        cursor = visited.get(cursor.parent) ?? {
          x,
          y,
          g: 0,
          h: 0,
          f: 0,
        };
      }

      return path.reverse();
    }

    closed.add(currentKey);

    [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ].forEach((neighbor) => {
      if (!grid[neighbor.y]?.[neighbor.x]) {
        return;
      }

      const neighborKey = pointKey(neighbor);
      if (closed.has(neighborKey)) {
        return;
      }

      const tentativeG = current.g + 1;
      const existing = open.get(neighborKey);
      if (existing && tentativeG >= existing.g) {
        return;
      }

      const h = heuristic(neighbor, goal);
      const nextNode = {
        ...neighbor,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: currentKey,
      } satisfies SearchNode;
      open.set(neighborKey, nextNode);
      visited.set(neighborKey, nextNode);
    });
  }

  return [origin, goal];
}
