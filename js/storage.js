const STORAGE_KEY = "tongitsTrackerGameV3";


function saveGame() {
    if (!game) return;

    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(game)
        );
    } catch (error) {
        console.error("Unable to save game:", error);

        showMessage(
            "Storage Full",
            "The game could not be saved. Try using smaller player photos."
        );
    }
}


function loadGame() {
    const saved =
        localStorage.getItem(STORAGE_KEY);

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

function clearAllAppData() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem("tongitsTrackerTheme");
        game = null;
        return true;
    } catch (error) {
        console.error("Unable to clear app data:", error);
        return false;
    }
}
