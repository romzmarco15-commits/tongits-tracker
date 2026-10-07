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

                if (type === "Fight") {
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

                    const base =
                        num(input.value);

                    payments.push({
                        from: index,
                        to: selectedWinner,

                        amount: base,
                        baseAmount: base,
                        quadraAmount: 0,

                        reason: "Fight"
                    });

                } else {
                    const base =
                        game.rules
                            .drawPayment;

                    payments.push({
                        from: index,
                        to: selectedWinner,

                        amount: base,
                        baseAmount: base,
                        quadraAmount: 0,

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
            quadra: false,
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
   QUADRA
========================================= */

document.getElementById(
    "quadraCheckbox"
).addEventListener(
    "change",
    function () {

        setPendingRoundQuadra(
            this.checked
        );

        renderRoundSummary();
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

        if (!pendingRound) return;

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

        finishRound(false);

        await animateRoundPotContribution();

        renderGame();
    }
);

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
   TAKE POT
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

        await animatePotToWinner(
            winnerIndex,
            potAmount
        );

        const result =
            finishRound(true);

        renderGame();

        showGameFinished(result);
    }
);


/* =========================================
   KEEP POT
========================================= */

document.getElementById(
    "keepPotButton"
).addEventListener(
    "click",
    async function () {

        closeOverlay(
            "potWinOverlay"
        );

        finishRound(false);

        await animateRoundPotContribution();

        renderGame();
    }
);


/* =========================================
   QUICK PAY
========================================= */

document.getElementById(
    "quickPayButton"
).addEventListener(
    "click",
    openQuickPay
);

document.getElementById(
    "quickPayReceiver"
).addEventListener(
    "change",
    renderQuickPayPayers
);

document.getElementById(
    "confirmQuickPayButton"
).addEventListener(
    "click",
    function () {

        const receiverIndex =
            Number(
                document.getElementById(
                    "quickPayReceiver"
                ).value
            );

        const amount =
            num(
                document.getElementById(
                    "quickPayAmount"
                ).value
            );

        const reason =
            document.getElementById(
                "quickPayReason"
            ).value.trim() ||
            "Quick Pay";

        const payerIndexes =
            Array.from(
                document.querySelectorAll(
                    ".quick-pay-payer:checked"
                )
            ).map(
                checkbox =>
                    Number(
                        checkbox.value
                    )
            );

        if (amount <= 0) {
            showMessage(
                "Invalid Amount",
                "Enter an amount greater than zero."
            );

            return;
        }

        if (
            payerIndexes.length === 0
        ) {
            showMessage(
                "No Payers Selected",
                "Select at least one player who will pay."
            );

            return;
        }

        const result =
            processQuickPay(
                receiverIndex,
                payerIndexes,
                amount,
                reason
            );

        if (!result) {
            showMessage(
                "Quick Pay",
                "The payment could not be recorded."
            );

            return;
        }

        closeOverlay(
            "quickPayOverlay"
        );

        renderGame();

        showMessage(
            "Payment Recorded",
            `${result.receiverName} received ${money(
                result.amountPerPlayer
            )} from each selected player for ${result.reason}.`
        );
    }
);

document.getElementById(
    "cancelQuickPayButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "quickPayOverlay"
        )
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

        if (!undoLastRound()) {
            showMessage(
                "Nothing to Undo",
                "There is nothing to undo."
            );

            return;
        }

        renderGame();

        showMessage(
            "Undone",
            "The last transaction was reversed."
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
    () => applyTheme("dark")
);

document.getElementById(
    "lightThemeButton"
).addEventListener(
    "click",
    () => applyTheme("light")
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

            quadraPayment:
                document.getElementById(
                    "settingQuadraPayment"
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
   OUTSIDE CLICK
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

                if (
                    this.id ===
                    "potWinOverlay"
                ) {
                    return;
                }

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
   LOAD
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