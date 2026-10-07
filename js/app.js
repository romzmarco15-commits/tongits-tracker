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

                if (fightSelectedPlayers.includes(index)) {
                    const input = document.getElementById(`fightAmount${index}`);
                    const fightValue = input ? input.value : (fightAmounts[index] ?? "");

                    if (String(fightValue).trim() === "" || num(fightValue) < 0) {
                        invalid = true;
                        return;
                    }

                    const base = num(fightValue);

                    payments.push({
                        from: index,
                        to: selectedWinner,

                        amount: base,
                        baseAmount: base,
                        bonusAmount: 0,

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
                        bonusAmount: 0,

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
            bonusEnabled: false,
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
   BONUS
========================================= */

function updatePendingBonusFromInputs() {
    if (!pendingRound || !pendingRound.bonusEnabled) return;
    setPendingRoundBonus(
        document.getElementById("bonusReason").value,
        document.getElementById("bonusAmount").value
    );
    renderRoundSummary();
}

document.getElementById("bonusToggleButton").addEventListener("click", function () {
    if (!pendingRound) return;

    if (pendingRound.bonusEnabled) {
        setPendingRoundBonus(
            document.getElementById("bonusReason").value,
            0
        );
    } else {
        const reason = game.rules.bonusReason || "Bonus";
        const amount = game.rules.bonusAmount;
        document.getElementById("bonusReason").value = reason;
        document.getElementById("bonusAmount").value = amount;
        setPendingRoundBonus(reason, amount);
    }

    const selected = Boolean(pendingRound.bonusEnabled);
    document.getElementById("bonusDetails").classList.toggle("hidden", !selected);
    this.classList.toggle("selected", selected);
    this.setAttribute("aria-pressed", String(selected));
    this.querySelector(".bonus-toggle-hint").textContent = selected ? "Selected" : "Tap to add";
    renderRoundSummary();
    activateSelectOnFocus();
});

document.getElementById("bonusReason").addEventListener("input", updatePendingBonusFromInputs);
document.getElementById("bonusAmount").addEventListener("input", updatePendingBonusFromInputs);


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
    "confirmQuickPayButton"
).addEventListener(
    "click",
    async function () {

        const receiverIndex = quickPayReceiverIndex;

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

        const payerIndexes = [...quickPaySelectedPayers];

        if (receiverIndex === null || receiverIndex === undefined) {
            showMessage("Choose Receiver", "Select the player who receives the payment.");
            return;
        }

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

        // Quick Pay is already confirmed and recorded in History.
        // Keep the OLD balances visible while the money travels, then refresh the
        // player cards AFTER the animation so the payer/payee amount changes are obvious.
        const animationPayments = result.payments.map(payment => ({
            from: payment.fromIndex,
            amount: payment.amount
        }));

        await animateWinnerPayments(
            animationPayments,
            result.receiverIndex
        );

        // Show the new balances only after the transfer completes.
        refreshAllBalances();
        saveGame();
        renderGame();
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
    "topCloseSettingsButton"
).addEventListener(
    "click",
    () =>
        closeOverlay(
            "settingsOverlay"
        )
);


/* =========================================
   SOUND SETTINGS
========================================= */

document.getElementById("soundEffectsToggle").addEventListener("click", function () {
    setSoundEffectsEnabled(!soundSettings.soundEffects);
    updateSoundSettingButtons();
    if (soundSettings.soundEffects) playSoundEffect("magic");
});

document.getElementById("clickSoundsToggle").addEventListener("click", function () {
    setClickSoundsEnabled(!soundSettings.clickSounds);
    updateSoundSettingButtons();
    if (soundSettings.clickSounds) playClickSound();
});


/* =========================================
   CLEAR ALL APP DATA
========================================= */

document.getElementById(
    "clearAllDataButton"
).addEventListener(
    "click",
    function () {
        closeOverlay("settingsOverlay");
        openOverlay("clearDataOverlay");
    }
);

document.getElementById(
    "cancelClearDataButton"
).addEventListener(
    "click",
    () => closeOverlay("clearDataOverlay")
);

document.getElementById(
    "topCloseClearDataButton"
).addEventListener(
    "click",
    () => closeOverlay("clearDataOverlay")
);

document.getElementById(
    "confirmClearDataButton"
).addEventListener(
    "click",
    function () {
        if (!clearAllAppData()) {
            closeOverlay("clearDataOverlay");
            showMessage(
                "Unable to Clear Data",
                "The app data could not be deleted from this device."
            );
            return;
        }

        window.location.reload();
    }
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

            bonusReason:
                document.getElementById("settingBonusReason").value,

            bonusAmount:
                document.getElementById("settingBonusAmount").value,

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

let afterMessageClose = null;

function closeMessageAndContinue() {
    closeOverlay("messageOverlay");

    const callback = afterMessageClose;
    afterMessageClose = null;

    if (typeof callback === "function") {
        callback();
    }
}

document.getElementById(
    "closeMessageButton"
).addEventListener(
    "click",
    closeMessageAndContinue
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
/* =========================================
   EASTER EGGS
========================================= */
let potEggTaps = [];
let predictionTimer = null;
let predictionRunning = false;
let lastMilestoneCelebrated = 0;

function eggToast(message, duration = 2200) {
    const toast = document.getElementById("easterToast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove("hidden");
    clearTimeout(eggToast._timer);
    eggToast._timer = setTimeout(() => toast.classList.add("hidden"), duration);
}

function openPotPrediction() {
    if (!game || !game.players || !game.players.length) return;
    document.getElementById("predictionRoulette").textContent = "Tap anywhere to predict";
    document.getElementById("predictionResult").textContent = "";
    document.getElementById("runPredictionButton").disabled = false;
    openOverlay("predictionOverlay");
}

document.getElementById("potArea").addEventListener("click", function () {
    if (!game || game.finished) return;
    const now = Date.now();
    potEggTaps = potEggTaps.filter(t => now - t <= 4500);
    potEggTaps.push(now);
    if (potEggTaps.length >= 10) {
        potEggTaps = [];
        openPotPrediction();
    }
});

document.getElementById("closePredictionButton").addEventListener("click", () => {
    if (!predictionRunning) closeOverlay("predictionOverlay");
});

function runPotPrediction() {
    if (!game || predictionRunning) return;

    predictionRunning = true;
    const button = document.getElementById("runPredictionButton");
    if (button) button.disabled = true;

    const modal = document.querySelector("#predictionOverlay .prediction-modal");
    const roulette = document.getElementById("predictionRoulette");
    const result = document.getElementById("predictionResult");

    if (modal) modal.classList.add("prediction-awakening");
    roulette.classList.add("spinning");
    result.textContent = "The cards are listening...";

    let ticks = 0;
    clearInterval(predictionTimer);
    predictionTimer = setInterval(() => {
        const p = game.players[ticks % game.players.length];
        roulette.textContent = `${p.name} ${["🔮","⚡","🪙","✨","🔥"][ticks % 5]}`;
        if (typeof playSoundEffect === "function") playSoundEffect("roll");
        ticks++;
    }, 82);

    setTimeout(() => {
        clearInterval(predictionTimer);
        const winnerIndex = Math.floor(Math.random() * game.players.length);
        const player = game.players[winnerIndex];

        roulette.classList.remove("spinning");
        roulette.classList.add("prediction-reveal");
        roulette.textContent = `🔮 ${player.name} 🔮`;
        result.textContent = `THE PROPHECY CHOOSES ${player.name.toUpperCase()}!`;

        if (modal) {
            modal.classList.remove("prediction-awakening");
            modal.classList.add("prediction-impact");
            setTimeout(() => modal.classList.remove("prediction-impact"), 850);
        }

        if (typeof playSoundEffect === "function") playSoundEffect("reveal");
        game.easterPrediction = { playerIndex: winnerIndex, playerName: player.name, round: game.round };
        saveGame();

        setTimeout(() => roulette.classList.remove("prediction-reveal"), 1200);
        predictionRunning = false;
        if (button) button.disabled = false;
    }, 2400);
}

document.getElementById("runPredictionButton").addEventListener("click", function (event) {
    event.stopPropagation();
    runPotPrediction();
});

// Only taps INSIDE the prediction popup trigger the prediction.
// Tapping the dark backdrop remains a normal outside-click and must not start it.
document.querySelector("#predictionOverlay .prediction-modal").addEventListener("click", function (event) {
    if (event.target.closest("#closePredictionButton")) return;
    runPotPrediction();
});

// Long-press a player card/avatar: Main Character Energy.
let eggLongPressTimer = null;
document.addEventListener("pointerdown", function (e) {
    const avatar = e.target.closest(".player-avatar, .avatar");
    if (!avatar) return;
    eggLongPressTimer = setTimeout(() => {
        avatar.classList.add("easter-spin");
        eggToast("Main Character Energy ✨");
        if (typeof playSoundEffect === "function") playSoundEffect("magic");
        setTimeout(() => avatar.classList.remove("easter-spin"), 1000);
    }, 3000);
});
["pointerup","pointercancel","pointermove"].forEach(type => document.addEventListener(type, () => clearTimeout(eggLongPressTimer)));

// Seven quick taps on a visible streak indicator.
let streakEggTaps = [];
document.addEventListener("click", function (e) {
    const streak = e.target.closest(".streak-badge, .streak, [class*='streak']");
    if (!streak || streak.closest("#settingsOverlay")) return;
    const now = Date.now();
    streakEggTaps = streakEggTaps.filter(t => now - t <= 3500);
    streakEggTaps.push(now);
    if (streakEggTaps.length >= 7) {
        streakEggTaps = [];
        streak.classList.add("easter-fire");
        eggToast("🔥 ON FIRE! 🔥");
        if (typeof playSoundEffect === "function") playSoundEffect("fire");
        setTimeout(() => streak.classList.remove("easter-fire"), 2400);
    }
});

function runPostRenderEasterEggs() {
    if (!game) return;
    const pot = Number(game.pot || 0);
    const milestone = pot >= 100 ? 100 : pot >= 50 ? 50 : 0;
    if (milestone && milestone > lastMilestoneCelebrated) {
        lastMilestoneCelebrated = milestone;
        const area = document.getElementById("potArea");
        area.classList.add("easter-confetti");
        eggToast(`🪙 POT JACKPOT — ${money(milestone)}!`);
        if (typeof playSoundEffect === "function") playSoundEffect("jackpot");
        setTimeout(() => area.classList.remove("easter-confetti"), 1300);
    }
}
