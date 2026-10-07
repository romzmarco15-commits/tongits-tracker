/* =========================================
   STARTUP
========================================= */

loadTheme();

initializeSetupData();
renderSetupPlayers();
activateSelectOnFocus();


/* =========================================
   PLAYER COUNT
========================================= */

document.getElementById(
    "decreasePlayersButton"
).addEventListener(
    "click",
    () => changePlayerCount(-1)
);

document.getElementById(
    "increasePlayersButton"
).addEventListener(
    "click",
    () => changePlayerCount(1)
);


/* =========================================
   CREATE GAME
========================================= */

function createGameFromSetup() {
    captureSetupInputs();

    const initialPot =
        Math.max(
            0,
            num(
                document.getElementById(
                    "initialPot"
                ).value
            )
        );

    const roundPot =
        Math.max(
            0,
            num(
                document.getElementById(
                    "roundPot"
                ).value
            )
        );

    const currency =
        document.getElementById(
            "currency"
        ).value;

    const players =
        setupPlayerData
            .slice(
                0,
                setupPlayerCount
            )
            .map(player => ({
                name:
                    String(player.name),

                money:
                    num(player.money),

                avatar:
                    clone(player.avatar)
            }));

    createGame(
        players,
        initialPot,
        roundPot,
        currency
    );

    editingExistingGame = false;

    showGame();
}

document.getElementById(
    "startGameButton"
).addEventListener(
    "click",
    function () {

        captureSetupInputs();

        if (
            editingExistingGame &&
            game
        ) {
            openOverlay(
                "newGameConfirmOverlay"
            );

            return;
        }

        createGameFromSetup();
    }
);

document.getElementById(
    "confirmNewGameButton"
).addEventListener(
    "click",
    function () {

        closeOverlay(
            "newGameConfirmOverlay"
        );

        createGameFromSetup();
    }
);

document.getElementById(
    "cancelNewGameButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "newGameConfirmOverlay"
        )
);

document.getElementById(
    "backToGameButton"
).addEventListener(
    "click",
    function () {

        editingExistingGame = false;
        showGame();
    }
);


/* =========================================
   AVATAR
========================================= */

document.getElementById(
    "uploadPhotoButton"
).addEventListener(
    "click",
    function () {

        document.getElementById(
            "avatarFileInput"
        ).click();
    }
);

document.getElementById(
    "avatarFileInput"
).addEventListener(
    "change",
    async function () {

        const file =
            this.files[0];

        if (
            !file ||
            avatarEditingPlayer === null
        ) {
            return;
        }

        if (
            !file.type.startsWith(
                "image/"
            )
        ) {
            showMessage(
                "Invalid Photo",
                "Please choose an image file."
            );

            this.value = "";
            return;
        }

        try {
            const photo =
                await resizePlayerPhoto(
                    file
                );

            setupPlayerData[
                avatarEditingPlayer
            ].avatar = {
                type: "photo",
                value: photo
            };

            closeOverlay(
                "avatarOverlay"
            );

            avatarEditingPlayer = null;

            renderSetupPlayers();

        } catch (error) {
            console.error(error);

            showMessage(
                "Photo Error",
                "The selected photo could not be loaded."
            );
        }

        this.value = "";
    }
);

document.getElementById(
    "cancelAvatarButton"
).addEventListener(
    "click",
    function () {

        avatarEditingPlayer = null;

        closeOverlay(
            "avatarOverlay"
        );
    }
);


/* =========================================
   WIN TYPE
========================================= */

document
    .querySelectorAll(
        ".result-button[data-result]"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            function () {

                const type =
                    this.dataset.result;

                closeOverlay(
                    "winOverlay"
                );

                if (
                    type === "Fight"
                ) {
                    buildFight();

                    openOverlay(
                        "fightOverlay"
                    );

                    return;
                }

                prepareNormalRound(type);

                showRoundConfirmation();
            }
        );
    });

document.getElementById(
    "cancelWinButton"
).addEventListener(
    "click",
    function () {

        selectedWinner = null;

        closeOverlay(
            "winOverlay"
        );
    }
);


/* =========================================
   FIGHT
========================================= */

document.getElementById(
    "confirmFightButton"
).addEventListener(
    "click",
    function () {

        const payments = [];
        let invalid = false;

        game.players.forEach(
            (player, index) => {

                if (
                    index ===
                    selectedWinner
                ) {
                    return;
                }

                const checkbox =
                    document.querySelector(
                        `.fighter-checkbox[data-player="${index}"]`
                    );

                if (
                    checkbox &&
                    checkbox.checked
                ) {
                    const input =
                        document.getElementById(
                            `fightAmount${index}`
                        );

                    if (
                        input.value.trim() === "" ||
                        num(input.value) < 0
                    ) {
                        invalid = true;
                        return;
                    }

                    payments.push({
                        from: index,
                        to: selectedWinner,
                        amount:
                            num(input.value),
                        reason: "Fight"
                    });

                } else {
                    payments.push({
                        from: index,
                        to: selectedWinner,
                        amount:
                            game.rules
                                .drawPayment,
                        reason:
                            "Did not fight"
                    });
                }
            }
        );

        if (invalid) {
            showMessage(
                "Missing Amount",
                "Enter an amount for every player who fought."
            );

            return;
        }

        pendingRound = {
            type: "Fight",
            winner: selectedWinner,
            payments
        };

        closeOverlay(
            "fightOverlay"
        );

        showRoundConfirmation();
    }
);

document.getElementById(
    "cancelFightButton"
).addEventListener(
    "click",
    function () {

        selectedWinner = null;

        closeOverlay(
            "fightOverlay"
        );
    }
);


/* =========================================
   CONFIRM ROUND
========================================= */

document.getElementById(
    "confirmRoundButton"
).addEventListener(
    "click",
    async function () {

        const winnerIndex =
            pendingRound.winner;

        const payments =
            clone(
                pendingRound.payments
            );

        const potDecisionNeeded =
            beginRoundSettlement();

        closeOverlay(
            "confirmRoundOverlay"
        );

        await animateWinnerPayments(
            payments,
            winnerIndex
        );

        if (potDecisionNeeded) {
            showPotConfirmation();
            return;
        }

        /*
            Normal round:
            collect next round contribution
            and continue.
        */

        finishRound(false);

        await animateRoundPotContribution();

        renderGame();
    }
);


/* =========================================
   CANCEL ROUND
========================================= */

document.getElementById(
    "cancelRoundButton"
).addEventListener(
    "click",
    function () {

        pendingRound = null;
        selectedWinner = null;

        closeOverlay(
            "confirmRoundOverlay"
        );
    }
);


/* =========================================
   YES — TAKE POT
========================================= */

document.getElementById(
    "takePotButton"
).addEventListener(
    "click",
    async function () {

        const winnerIndex =
            pendingRound.winner;

        const potAmount =
            pendingRound.potBefore;

        closeOverlay(
            "potWinOverlay"
        );

        /*
            Show old pot travelling to winner.
        */

        await animatePotToWinner(
            winnerIndex,
            potAmount
        );

        /*
            IMPORTANT:
            finishRound(true) now ENDS GAME.

            It does NOT collect another
            round-pot contribution.
        */

        const result =
            finishRound(true);

        renderGame();

        showGameFinished(result);
    }
);


/* =========================================
   NO — KEEP POT
========================================= */

document.getElementById(
    "keepPotButton"
).addEventListener(
    "click",
    async function () {

        closeOverlay(
            "potWinOverlay"
        );

        /*
            NO means game continues.

            New round contribution is
            collected normally.
        */

        finishRound(false);

        await animateRoundPotContribution();

        renderGame();
    }
);


/* =========================================
   GAME FINISHED
========================================= */

document.getElementById(
    "viewFinalResultsButton"
).addEventListener(
    "click",
    function () {

        closeOverlay(
            "gameFinishedOverlay"
        );

        renderGame();
    }
);

document.getElementById(
    "finishedStartNewGameButton"
).addEventListener(
    "click",
    function () {

        closeOverlay(
            "gameFinishedOverlay"
        );

        openOverlay(
            "finishedNewGameOverlay"
        );
    }
);


/* =========================================
   FINISHED -> SAME PLAYERS KEEP MONEY
========================================= */

document.getElementById(
    "finishedKeepMoneyButton"
).addEventListener(
    "click",
    function () {

        restartKeepMoney();

        closeOverlay(
            "finishedNewGameOverlay"
        );

        renderGame();

        showMessage(
            "New Game Started",
            `Current final balances were used as the new starting money. ${money(
                game.initialPot
            )} per player was collected for the new pot.`
        );
    }
);


/* =========================================
   FINISHED -> SAME PLAYERS RESET MONEY
========================================= */

document.getElementById(
    "finishedResetMoneyButton"
).addEventListener(
    "click",
    function () {

        restartResetMoney();

        closeOverlay(
            "finishedNewGameOverlay"
        );

        renderGame();

        showMessage(
            "New Game Started",
            `Players were reset to their original starting money. ${money(
                game.initialPot
            )} per player was collected for the new pot.`
        );
    }
);


/* =========================================
   FINISHED -> EDIT PLAYERS
========================================= */

document.getElementById(
    "finishedEditPlayersButton"
).addEventListener(
    "click",
    function () {

        closeOverlay(
            "finishedNewGameOverlay"
        );

        showEditPlayersSetup();
    }
);

document.getElementById(
    "cancelFinishedNewGameButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "finishedNewGameOverlay"
        )
);


/* =========================================
   FINAL SCREEN START NEW GAME BUTTON
========================================= */

document.getElementById(
    "finalScreenNewGameButton"
).addEventListener(
    "click",
    function () {

        openOverlay(
            "finishedNewGameOverlay"
        );
    }
);


/* =========================================
   UNDO
========================================= */

document.getElementById(
    "undoButton"
).addEventListener(
    "click",
    function () {

        if (
            !undoLastRound()
        ) {
            showMessage(
                "Nothing to Undo",
                "There are no completed rounds to undo."
            );

            return;
        }

        renderGame();

        showMessage(
            "Round Undone",
            `Restored to Round ${game.round}.`
        );
    }
);


/* =========================================
   HISTORY
========================================= */

document.getElementById(
    "historyButton"
).addEventListener(
    "click",
    openHistory
);

document.getElementById(
    "closeHistoryButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "historyOverlay"
        )
);

document.getElementById(
    "topCloseHistoryButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "historyOverlay"
        )
);


/* =========================================
   RULES
========================================= */

document.getElementById(
    "rulesButton"
).addEventListener(
    "click",
    openRules
);

document.getElementById(
    "closeRulesButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "rulesOverlay"
        )
);

document.getElementById(
    "topCloseRulesButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "rulesOverlay"
        )
);


/* =========================================
   SETTINGS
========================================= */

document.getElementById(
    "settingsButton"
).addEventListener(
    "click",
    openSettings
);

document.getElementById(
    "closeSettingsButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "settingsOverlay"
        )
);

document.getElementById(
    "topCloseSettingsButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "settingsOverlay"
        )
);


/* =========================================
   THEME
========================================= */

document.getElementById(
    "darkThemeButton"
).addEventListener(
    "click",
    () =>
        applyTheme("dark")
);

document.getElementById(
    "lightThemeButton"
).addEventListener(
    "click",
    () =>
        applyTheme("light")
);


/* =========================================
   SAVE SETTINGS
========================================= */

document.getElementById(
    "saveSettingsButton"
).addEventListener(
    "click",
    function () {

        updateGameSettings({
            drawPayment:
                document.getElementById(
                    "settingDrawPayment"
                ).value,

            tongitsPayment:
                document.getElementById(
                    "settingTongitsPayment"
                ).value,

            initialPot:
                document.getElementById(
                    "settingInitialPot"
                ).value,

            roundPot:
                document.getElementById(
                    "settingRoundPot"
                ).value,

            potWinStreak:
                document.getElementById(
                    "settingPotStreak"
                ).value
        });

        closeOverlay(
            "settingsOverlay"
        );

        renderGame();

        showMessage(
            "Settings Saved",
            "The game rules were updated."
        );
    }
);


/* =========================================
   EDIT PLAYERS
========================================= */

document.getElementById(
    "editPlayersButton"
).addEventListener(
    "click",
    function () {

        closeOverlay(
            "settingsOverlay"
        );

        showEditPlayersSetup();
    }
);


/* =========================================
   RESTART
========================================= */

document.getElementById(
    "restartGameButton"
).addEventListener(
    "click",
    function () {

        closeOverlay(
            "settingsOverlay"
        );

        openOverlay(
            "restartOverlay"
        );
    }
);

document.getElementById(
    "restartKeepMoneyButton"
).addEventListener(
    "click",
    function () {

        restartKeepMoney();

        closeOverlay(
            "restartOverlay"
        );

        renderGame();

        showMessage(
            "Game Restarted",
            `Initial pot of ${money(
                game.initialPot
            )} per player was collected.`
        );
    }
);

document.getElementById(
    "restartResetMoneyButton"
).addEventListener(
    "click",
    function () {

        restartResetMoney();

        closeOverlay(
            "restartOverlay"
        );

        renderGame();

        showMessage(
            "Game Reset",
            `Players were reset and ${money(
                game.initialPot
            )} per player was collected for the initial pot.`
        );
    }
);

document.getElementById(
    "cancelRestartButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "restartOverlay"
        )
);


/* =========================================
   MESSAGE
========================================= */

document.getElementById(
    "closeMessageButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "messageOverlay"
        )
);


/* =========================================
   GLOBAL OUTSIDE CLICK
========================================= */

document
    .querySelectorAll(".overlay")
    .forEach(overlay => {

        overlay.addEventListener(
            "click",
            function (event) {

                if (
                    event.target !== this
                ) {
                    return;
                }

                /*
                    Pot decision requires
                    explicit YES or NO.
                */

                if (
                    this.id ===
                    "potWinOverlay"
                ) {
                    return;
                }

                /*
                    Game Finished popup:
                    force View Results or
                    Start New Game.
                */

                if (
                    this.id ===
                    "gameFinishedOverlay"
                ) {
                    return;
                }

                if (
                    this.id ===
                    "winOverlay"
                ) {
                    selectedWinner = null;
                }

                if (
                    this.id ===
                    "fightOverlay"
                ) {
                    selectedWinner = null;
                }

                if (
                    this.id ===
                    "confirmRoundOverlay"
                ) {
                    pendingRound = null;
                    selectedWinner = null;
                }

                if (
                    this.id ===
                    "avatarOverlay"
                ) {
                    avatarEditingPlayer = null;
                }

                this.classList.add(
                    "hidden"
                );
            }
        );
    });


/* =========================================
   LOAD SAVED GAME
========================================= */

if (loadGame()) {
    ensureDebtState();
    showGame();

} else {
    document.getElementById(
        "initialPot"
    ).value = 4;

    showFreshSetup();
}