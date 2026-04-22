export const ROOM_GRID_SIZE = 13;

export const HIDDEN_ROOM_TYPES = new Set([
    "secret",
    "supersecret",
    "red",
    "blue",
    "ultrasecret"
]);

export const DEAD_END_SPECIAL_ROOM_TYPES = new Set([
    "boss",
    "shop",
    "item",
    "planetarium",
    "dice",
    "sacrifice",
    "library",
    "curse",
    "miniboss",
    "challenge",
    "bosschallenge",
    "arcade",
    "vault",
    "bedroom"
]);

export const NON_ROCK_ROOM_TYPES = new Set([
    "secret",
    "supersecret",
    "ultrasecret",
    "red",
    "blue",
    "boss",
    "start",
    "sacrifice",
    "challenge",
    "bosschallenge",
    "planetarium",
    "shop",
    "curse",
    "arcade",
    "dice"
]);

export function isInBounds(y, x) {
    return y >= 0 && y < ROOM_GRID_SIZE && x >= 0 && x < ROOM_GRID_SIZE;
}

export function isMegaSatanSpot(stage, y, x) {
    return stage === 11 && y === 5 && x === 6;
}

export function cloneRoom(room) {
    if (!room) {
        return null;
    }
    return {
        ...room,
        rocks: Array.isArray(room.rocks) ? [...room.rocks] : [false, false, false, false]
    };
}

export function cloneMap(map) {
    return map.map(row => row.map(room => cloneRoom(room)));
}

export function createRoom(posY, posX, type = "empty", overrides = {}) {
    return {
        type,
        posY,
        posX,
        deadEnd: false,
        neighbours: [],
        secretWeight: 10,
        rocks: [false, false, false, false],
        hidden: false,
        ...overrides,
        rocks: overrides.rocks ? [...overrides.rocks] : [false, false, false, false]
    };
}

export function getNeighborCoords(y, x) {
    return [
        [y + 1, x],
        [y - 1, x],
        [y, x + 1],
        [y, x - 1]
    ].filter(([nextY, nextX]) => isInBounds(nextY, nextX));
}

export function getNeighbours(map, roomOrY, xMaybe) {
    const y = typeof roomOrY === "object" ? roomOrY.posY : roomOrY;
    const x = typeof roomOrY === "object" ? roomOrY.posX : xMaybe;
    return getNeighborCoords(y, x)
        .map(([nextY, nextX]) => map[nextY][nextX])
        .filter(Boolean);
}

export function getRockIndex(fromY, fromX, toY, toX) {
    if (toY === fromY - 1 && toX === fromX) {
        return 0;
    }
    if (toY === fromY + 1 && toX === fromX) {
        return 1;
    }
    if (toY === fromY && toX === fromX - 1) {
        return 2;
    }
    if (toY === fromY && toX === fromX + 1) {
        return 3;
    }
    return null;
}

export function hasBlockingRock(map, fromY, fromX, toY, toX) {
    if (!isInBounds(fromY, fromX) || !isInBounds(toY, toX)) {
        return false;
    }
    const room = map[fromY][fromX];
    if (!room || !Array.isArray(room.rocks)) {
        return false;
    }
    const rockIndex = getRockIndex(fromY, fromX, toY, toX);
    return rockIndex != null ? Boolean(room.rocks[rockIndex]) : false;
}

export function cellBlockedByVisibleRock(map, y, x) {
    for (const [neighborY, neighborX] of getNeighborCoords(y, x)) {
        if (hasBlockingRock(map, neighborY, neighborX, y, x)) {
            return true;
        }
    }
    return false;
}

export function buildInitialVisibleMap(map) {
    return map.map((row, y) => row.map((room, x) => {
        if (!room) {
            return null;
        }
        if (room.hidden && HIDDEN_ROOM_TYPES.has(room.type)) {
            return null;
        }
        return cloneRoom(room) ?? createRoom(y, x);
    }));
}

export function calculateTileDistances(map) {
    const distances = [...Array(ROOM_GRID_SIZE)].map(() => Array(ROOM_GRID_SIZE).fill(null));
    if (!map) {
        return distances;
    }

    let startRoom = null;
    for (let y = 0; y < ROOM_GRID_SIZE; y += 1) {
        for (let x = 0; x < ROOM_GRID_SIZE; x += 1) {
            if (map[y][x] && map[y][x].type === "start") {
                startRoom = map[y][x];
                break;
            }
        }
        if (startRoom) {
            break;
        }
    }

    if (!startRoom) {
        return distances;
    }

    const queue = [[startRoom.posY, startRoom.posX]];
    distances[startRoom.posY][startRoom.posX] = 0;

    while (queue.length > 0) {
        const [currentY, currentX] = queue.shift();
        const currentDistance = distances[currentY][currentX];

        for (const [nextY, nextX] of getNeighborCoords(currentY, currentX)) {
            if (!map[nextY][nextX] || distances[nextY][nextX] != null) {
                continue;
            }
            distances[nextY][nextX] = currentDistance + 1;
            queue.push([nextY, nextX]);
        }
    }

    return distances;
}

export function calculateInitialVisibleTileDistances(map) {
    return calculateTileDistances(buildInitialVisibleMap(map));
}

export function getSecretCandidateProfile(map, stage, y, x) {
    if (!isInBounds(y, x) || map[y][x] || cellBlockedByVisibleRock(map, y, x)) {
        return null;
    }

    let invalid = false;
    let numNeighbours = 0;
    for (const neighbour of getNeighbours(map, y, x)) {
        if (neighbour.type === "boss" || neighbour.type === "supersecret") {
            invalid = true;
            break;
        }
        numNeighbours += 1;
    }

    if (isMegaSatanSpot(stage, y, x)) {
        invalid = true;
    }

    let minWeight = 0;
    let maxWeight = 0;
    if (!invalid && numNeighbours >= 3) {
        minWeight = 10;
        maxWeight = 14;
    } else if (!invalid && numNeighbours === 2) {
        minWeight = 7;
        maxWeight = 11;
    } else if (!invalid && numNeighbours === 1) {
        minWeight = 4;
        maxWeight = 8;
    }

    return {
        posY: y,
        posX: x,
        invalid,
        numNeighbours,
        minWeight,
        maxWeight
    };
}

export function getSupportedSecretCandidates(map, stage) {
    const profiles = [];
    for (let y = 0; y < ROOM_GRID_SIZE; y += 1) {
        for (let x = 0; x < ROOM_GRID_SIZE; x += 1) {
            const profile = getSecretCandidateProfile(map, stage, y, x);
            if (profile) {
                profiles.push(profile);
            }
        }
    }

    return profiles.filter(profile => {
        if (profile.maxWeight <= 0) {
            return false;
        }
        const otherProfiles = profiles.filter(other => other !== profile);
        const maxOtherMinWeight = otherProfiles.reduce((best, other) => Math.max(best, other.minWeight), 0);
        return profile.maxWeight >= maxOtherMinWeight;
    });
}

export function buildRedBlueCandidateMap(baseMap, stage) {
    const workingMap = cloneMap(baseMap);

    for (let x = 0; x < ROOM_GRID_SIZE; x += 1) {
        for (let y = 0; y < ROOM_GRID_SIZE; y += 1) {
            if (workingMap[y][x] || cellBlockedByVisibleRock(baseMap, y, x)) {
                continue;
            }

            const neighbours = getNeighbours(workingMap, y, x);
            let valid = neighbours.length > 0;
            let redCounter = 0;
            let blue = false;

            for (const neighbour of neighbours) {
                if (neighbour.type === "boss" || neighbour.type === "curse" || neighbour.type === "secret" || neighbour.type === "supersecret") {
                    blue = true;
                }
                if (neighbour.type === "red" || neighbour.type === "blue") {
                    redCounter += 1;
                }
            }

            if (redCounter === neighbours.length || isMegaSatanSpot(stage, y, x)) {
                valid = false;
            }

            if (valid) {
                workingMap[y][x] = createRoom(y, x, blue ? "blue" : "red", { hidden: true });
            }
        }
    }

    return workingMap;
}

export function collectWeightedUltraCandidates(redBlueMap) {
    const weightedCandidates = [];

    for (let x = 1; x < ROOM_GRID_SIZE - 1; x += 1) {
        for (let y = 1; y < ROOM_GRID_SIZE - 1; y += 1) {
            if (redBlueMap[y][x]) {
                continue;
            }

            const neighbours = getNeighbours(redBlueMap, y, x);
            if (neighbours.length === 0 || neighbours.some(neighbour => neighbour.type !== "red")) {
                continue;
            }

            const roomSet = new Set();
            for (const redNeighbour of neighbours) {
                for (const adjacentRoom of getNeighbours(redBlueMap, redNeighbour)) {
                    if (adjacentRoom.type !== "red" && adjacentRoom.type !== "blue") {
                        roomSet.add(`${adjacentRoom.posY}|${adjacentRoom.posX}`);
                    }
                }
            }

            if (roomSet.size >= 3) {
                weightedCandidates.push({ posY: y, posX: x, weight: 11.5 });
            } else if (roomSet.size === 2) {
                weightedCandidates.push({ posY: y, posX: x, weight: 1 });
            }
        }
    }

    return weightedCandidates;
}

export function buildUltraWorlds(baseMap, stage) {
    const redBlueMap = buildRedBlueCandidateMap(baseMap, stage);
    const ultraCandidates = collectWeightedUltraCandidates(redBlueMap);

    return ultraCandidates.map(candidate => {
        const worldMap = cloneMap(baseMap);
        const retainedRedCoords = [];

        worldMap[candidate.posY][candidate.posX] = createRoom(candidate.posY, candidate.posX, "ultrasecret", { hidden: true });

        for (let y = 0; y < ROOM_GRID_SIZE; y += 1) {
            for (let x = 0; x < ROOM_GRID_SIZE; x += 1) {
                const room = redBlueMap[y][x];
                if (!room || room.type !== "red") {
                    continue;
                }

                const touchesUltra = getNeighborCoords(y, x).some(([neighborY, neighborX]) => neighborY === candidate.posY && neighborX === candidate.posX);
                if (touchesUltra) {
                    retainedRedCoords.push([y, x]);
                    worldMap[y][x] = createRoom(y, x, "red", { hidden: true });
                }
            }
        }

        return {
            posY: candidate.posY,
            posX: candidate.posX,
            weight: candidate.weight,
            retainedRedCoords,
            map: worldMap
        };
    });
}
