import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
    buildUltraWorlds,
    calculateInitialVisibleTileDistances,
    createRoom,
    getSupportedSecretCandidates
} from "../RoomRules.js";

function createEmptyMap() {
    return [...Array(13)].map(() => Array(13).fill(null));
}

function addRoom(map, posY, posX, type = "empty", overrides = {}) {
    map[posY][posX] = createRoom(posY, posX, type, overrides);
}

test("initial tile distances ignore hidden rooms", () => {
    const map = createEmptyMap();
    addRoom(map, 6, 6, "start");
    addRoom(map, 6, 7, "secret", { hidden: true });
    addRoom(map, 6, 8, "empty");

    const distances = calculateInitialVisibleTileDistances(map);
    assert.equal(distances[6][6], 0);
    assert.equal(distances[6][8], null);
});

test("secret support keeps stronger candidates and rejects impossible weak ones", () => {
    const map = createEmptyMap();
    addRoom(map, 6, 6, "start");
    addRoom(map, 5, 7, "empty");
    addRoom(map, 6, 8, "empty");
    addRoom(map, 7, 7, "empty");

    const supported = getSupportedSecretCandidates(map, 1)
        .map(candidate => `${candidate.posY}|${candidate.posX}`);

    assert.ok(supported.includes("6|7"));
    assert.ok(supported.includes("5|6"));
    assert.ok(!supported.includes("6|5"));
});

test("ultra worlds keep the red rooms that border the selected ultra secret", () => {
    const map = createEmptyMap();
    addRoom(map, 6, 6, "start");
    addRoom(map, 5, 7, "empty");
    addRoom(map, 6, 8, "empty");
    addRoom(map, 7, 7, "empty");
    addRoom(map, 7, 5, "empty");
    addRoom(map, 8, 6, "empty");

    const ultraWorlds = buildUltraWorlds(map, 1);
    const matchingWorld = ultraWorlds.find(world => world.posY === 6 && world.posX === 4);

    assert.ok(matchingWorld);
    assert.deepEqual(matchingWorld.retainedRedCoords, [[6, 5], [7, 4]]);
});

test("core uses curseLost when constructing the generator", () => {
    const coreSource = fs.readFileSync(new URL("../core.js", import.meta.url), "utf8");
    assert.match(coreSource, /new Generator\(levelnum, curseLabyrinth, curseLost, hard\)/);
});
