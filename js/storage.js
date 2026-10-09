const STORAGE_KEY = "tongitsTrackerGameV3";


const GAME_DB_NAME = "tongitsTrackerDurableV1";
let saveQueue = Promise.resolve();
let lastSaveOK = true;
function openGameDB() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) { reject(new Error("IndexedDB unavailable")); return; }
        const request = indexedDB.open(GAME_DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("games");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function readDurableGame() {
    const db = await openGameDB();
    try { return await new Promise((resolve, reject) => {
        const tx = db.transaction("games", "readonly");
        const req = tx.objectStore("games").get("current");
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    }); } finally { db.close(); }
}
async function writeDurableGame(data) {
    const db = await openGameDB();
    try { await new Promise((resolve, reject) => {
        const tx = db.transaction("games", "readwrite");
        tx.objectStore("games").put(data, "current");
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    }); } finally { db.close(); }
}
function saveGame() {
    if (!game) return;
    // Capture immediately; serialise writes so a slower earlier save never wins.
    const snapshot = JSON.stringify(game);
    saveQueue = saveQueue.catch(() => {}).then(async () => {
        try {
            await writeDurableGame(JSON.parse(snapshot));
            lastSaveOK = true;
            // Remove the large legacy localStorage copy ONLY after durable save succeeded.
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            lastSaveOK = false;
            console.error("Game save failed:", error);
            showMessage("Save Failed", "Your latest changes are not safely saved. Keep this page open and free some browser storage before continuing.");
        }
    });
    return saveQueue;
}
async function loadGameAsync() {
    try {
        const durable = await readDurableGame();
        if (durable) {
            // Reuse the established normalization/migration routine without losing data.
            const ok = loadGame(JSON.stringify(durable));
            // No need to retain duplicate data in localStorage.
            localStorage.removeItem(STORAGE_KEY);
            return ok;
        }
    } catch (error) { console.warn("Durable storage read failed; checking legacy save", error); }
    const loadedLegacy = loadGame();
    if (loadedLegacy) await saveGame();
    return loadedLegacy;
}
function loadGame(savedOverride = null) {
    const saved = savedOverride || localStorage.getItem(STORAGE_KEY);

    if (!saved) {
        return false;
    }

    try {
        const loaded =
            JSON.parse(saved);

        if (
            !loaded ||
            !Array.isArray(loaded.players)
        ) {
            return false;
        }

        game = loaded;

        game.history =
            game.history || [];

        game.undoStack =
            game.undoStack || [];

        game.rules = {
            ...DEFAULT_RULES,
            ...(game.rules || {})
        };

        game.initialPot =
            game.initialPot !== undefined
                ? Number(game.initialPot)
                : 4;

        game.pot =
            Number(game.pot) || 0;

        game.round =
            Number(game.round) || 1;


        game.players.forEach(
            (player, index) => {

                /*
                    Migration support for older
                    versions that stored an emoji
                    directly as a string.
                */

                if (
                    typeof player.avatar ===
                    "string"
                ) {
                    player.avatar =
                        createEmojiAvatar(
                            player.avatar
                        );
                }


                if (!player.avatar) {
                    player.avatar =
                        createEmojiAvatar(
                            AVATARS[
                                index %
                                AVATARS.length
                            ]
                        );
                }


                player.streak =
                    Number(
                        player.streak
                    ) || 0;

                player.balance =
                    Number(
                        player.balance
                    ) || 0;


                if (
                    player.startingBalance ===
                    undefined
                ) {
                    player.startingBalance =
                        player.balance +
                        game.initialPot;
                }
            }
        );

        return true;

    } catch (error) {

        console.error(
            "Unable to load game:",
            error
        );

        return false;
    }
}

async function clearAllAppData() {
    await saveQueue.catch(() => {});
    try {
        const db = await openGameDB();
        await new Promise((resolve,reject) => { const tx=db.transaction("games","readwrite"); tx.objectStore("games").delete("current"); tx.oncomplete=resolve; tx.onerror=()=>reject(tx.error); });
        db.close();
    } catch(error) { console.error("Unable to clear durable game:",error); return false; }
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("tongitsTrackerTheme");
        localStorage.removeItem("tongitsTrackerSoundSettingsV1");
        localStorage.removeItem("tongitsShowBreakdown");
        game = null;
        return true;
    } catch (error) {
        console.error("Unable to clear app data:", error);
        return false;
    }
}
