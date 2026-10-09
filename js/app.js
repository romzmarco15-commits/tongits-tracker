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
                    pendingRound = {type: "Fight", winner: selectedWinner, bonusEnabled: false, payments: []};
                    selectedRoundBonuses = [];
                    updateRoundBonusUI("fightBonusTypesRound");

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

                        reason: "Did not fight"
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
        setPendingRoundBonuses(selectedRoundBonuses);
        closeOverlay("fightOverlay");
        document.getElementById("confirmRoundButton").click();
    }
);

document.getElementById(
    "cancelFightButton"
).addEventListener(
    "click",
    function () {

        selectedWinner = null;
        pendingRound = null;
        selectedRoundBonuses = [];

        closeOverlay(
            "fightOverlay"
        );
    }
);


/* =========================================
   BONUS
========================================= */

let selectedRoundBonuses = [];
function updateRoundBonusUI(areaId = "bonusTypesRound") {
    if (!pendingRound) return;
    setPendingRoundBonuses(selectedRoundBonuses);
    const area = document.getElementById(areaId);
    const opponents = game.players.map((p,i)=>({p,i})).filter(x=>x.i!==pendingRound.winner);
    area.innerHTML = (game.rules.bonusTypes || []).map(type => {
        const selected = selectedRoundBonuses.find(b=>b.id===type.id);
        return `<div class="bonus-type-item">
          <button type="button" class="bonus-type-choice ${selected?'selected':''}" data-bonus-choice="${escapeAttribute(type.id)}" aria-pressed="${Boolean(selected)}">🎁 ${escapeHtml(type.name)} · ${money(type.amount)} <span>${selected?'✓':''}</span></button>
          ${selected ? `<div class="bonus-type-options"><label>Amount per affected player <input type="number" step="1" min="0" data-bonus-amount="${escapeAttribute(type.id)}" value="${selected.amount}"></label><div class="player-select-grid">${opponents.map(({p,i})=>`<button type="button" class="player-select-button ${selected.targets.includes(i)?'selected':''}" data-bonus-target="${escapeAttribute(type.id)}" data-index="${i}" aria-pressed="${selected.targets.includes(i)}"><span class="player-select-avatar">${avatarContent(p.avatar)}</span><span class="player-select-name">${escapeHtml(p.name)}</span></button>`).join('')}</div></div>` : ''}
        </div>`;
    }).join('') || '<p>No bonus types configured. Add them in Settings.</p>';
    area.querySelectorAll('[data-bonus-choice]').forEach(button=>button.addEventListener('click',()=>{
        const id=button.dataset.bonusChoice; const existing=selectedRoundBonuses.find(b=>b.id===id);
        if(existing) selectedRoundBonuses=selectedRoundBonuses.filter(b=>b.id!==id);
        else {const type=game.rules.bonusTypes.find(b=>b.id===id);selectedRoundBonuses.push({id:type.id,name:type.name,amount:type.amount,targets:opponents.map(x=>x.i)});}
        updateRoundBonusUI(areaId);
    }));
    area.querySelectorAll('[data-bonus-target]').forEach(button=>button.addEventListener('click',()=>{
        const b=selectedRoundBonuses.find(b=>b.id===button.dataset.bonusTarget); const i=Number(button.dataset.index);
        b.targets=b.targets.includes(i)?b.targets.filter(x=>x!==i):[...b.targets,i]; updateRoundBonusUI(areaId);
    }));
    area.querySelectorAll('[data-bonus-amount]').forEach(input=>input.addEventListener('input',()=>{
        const b=selectedRoundBonuses.find(b=>b.id===input.dataset.bonusAmount);b.amount=Math.max(0,Number(input.value)||0);
        setPendingRoundBonuses(selectedRoundBonuses);if(areaId === "bonusTypesRound") renderRoundSummary();
    }));
    if(areaId === "bonusTypesRound") renderRoundSummary();
}

let editedBonusTypes=[];
function renderBonusTypeSettings(){
 const area=document.getElementById('bonusTypesSettings');if(!area)return;
 area.innerHTML=editedBonusTypes.map((b,i)=>`<div class="bonus-settings-row"><input type="text" data-bonus-name="${i}" value="${escapeAttribute(b.name)}" aria-label="Bonus name"><input type="number" min="0" step="1" data-bonus-rate="${i}" value="${b.amount}" aria-label="Bonus amount"><button type="button" data-remove-bonus="${i}" aria-label="Remove bonus">✕</button></div>`).join('');
 area.querySelectorAll('[data-bonus-name]').forEach(el=>el.addEventListener('input',()=>editedBonusTypes[Number(el.dataset.bonusName)].name=el.value));
 area.querySelectorAll('[data-bonus-rate]').forEach(el=>el.addEventListener('input',()=>editedBonusTypes[Number(el.dataset.bonusRate)].amount=Math.max(0,Number(el.value)||0)));
 area.querySelectorAll('[data-remove-bonus]').forEach(el=>el.addEventListener('click',()=>{editedBonusTypes.splice(Number(el.dataset.removeBonus),1);renderBonusTypeSettings()}));
}
document.getElementById('addBonusTypeButton').addEventListener('click',()=>{editedBonusTypes.push({id:'custom-'+Date.now()+'-'+editedBonusTypes.length,name:'New Bonus',amount:2});renderBonusTypeSettings()});

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
    function () {

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

document.getElementById("finishedContinueCycleButton").addEventListener("click", function () {
    if (!continuePotCycle()) return;
    closeOverlay("finishedNewGameOverlay");
    renderGame();
    showMessage("New Pot Started", `Same financial session: balances, debts, and history are preserved. ${money(game.initialPot)} per player was added to the new pot (or recorded as debt).`);
});

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
    async function () {
        if (!await clearAllAppData()) {
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

        game.rules.bonusTypes = editedBonusTypes.filter(b=>b.name.trim()).map(b=>({...b,name:b.name.trim()}));
        localStorage.setItem("tongitsShowBreakdown", String(document.getElementById("settingPaymentBreakdown").checked));
        updateGameSettings({
            drawPayment:
                document.getElementById(
                    "settingDrawPayment"
                ).value,

            tongitsPayment:
                document.getElementById(
                    "settingTongitsPayment"
                ).value,

            bonusReason: game.rules.bonusReason,
            bonusAmount: game.rules.bonusAmount,
            bonusTypes: game.rules.bonusTypes,

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
                    pendingRound = null;
                    selectedRoundBonuses = [];
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

loadGameAsync().then(loaded => {
if (loaded) {
    ensureDebtState();
    showGame();
} else {
    document.getElementById(
        "initialPot"
    ).value = 4;

    showFreshSetup();
}
}).catch(error => { console.error("Game startup failed",error); showMessage("Load Error","Unable to load your saved game. Please do not clear app data."); });
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
    document.getElementById("predictionRoulette").textContent = "Tap PREDICT";
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

document.getElementById("runPredictionButton").addEventListener("click", function () {
    if (!game || predictionRunning) return;
    predictionRunning = true;
    this.disabled = true;
    const roulette = document.getElementById("predictionRoulette");
    const result = document.getElementById("predictionResult");
    roulette.classList.add("spinning");
    result.textContent = "Consulting extremely reliable sources...";
    let ticks = 0;
    clearInterval(predictionTimer);
    predictionTimer = setInterval(() => {
        const p = game.players[ticks % game.players.length];
        roulette.textContent = `${p.name} ${["🔮","🪙","✨"][ticks % 3]}`;
        if (typeof playSoundEffect === "function") playSoundEffect("roll");
        ticks++;
    }, 90);
    setTimeout(() => {
        clearInterval(predictionTimer);
        const winnerIndex = Math.floor(Math.random() * game.players.length);
        const player = game.players[winnerIndex];
        roulette.classList.remove("spinning");
        roulette.textContent = `🔮 ${player.name}`;
        result.textContent = `Prediction: ${player.name} will win the pot!`;
        if (typeof playSoundEffect === "function") playSoundEffect("reveal");
        game.easterPrediction = { playerIndex: winnerIndex, playerName: player.name };
        saveGame();
        predictionRunning = false;
        document.getElementById("runPredictionButton").disabled = false;
    }, 2400);
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

// Small disclosure button at the top-right of each player card.
document.addEventListener("click", event => {
    const button = event.target.closest("[data-details-player]");
    if (!button || !game || localStorage.getItem("tongitsShowBreakdown") === "false") return;
    const index = Number(button.dataset.detailsPlayer);
    const card = button.closest("[data-player-card]");
    const panel = card?.querySelector(".player-details-collapse");
    if (!panel) return;
    const open = !expandedPlayerDetails.has(index);
    if (open) expandedPlayerDetails.add(index); else expandedPlayerDetails.delete(index);
    panel.classList.toggle("expanded", open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", `${open ? "Hide" : "Show"} payment details`);
});

document.getElementById("viewSettlementButton").addEventListener("click", () => { renderFinalSettlement(); openOverlay("gameFinishedOverlay"); });
