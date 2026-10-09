const AVATARS = [
    "😎", "🤓", "🧑", "👩",
    "🐼", "🐯", "🐸", "👽",
    "😈", "🤠", "🥸", "🦁"
];

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

const THEME_KEY = "tongitsTrackerTheme";

let setupPlayerCount = 3;
let setupPlayerData = [];

let avatarEditingPlayer = null;
let editingExistingGame = false;

// Modern multi-select state (no checkboxes)
let quickPayReceiverIndex = null;
let quickPaySelectedPayers = [];
let fightSelectedPlayers = [];
let fightAmounts = {};
let sunogSelectedPlayers = [];


/* =========================================
   HTML
========================================= */

function escapeHtml(value) {
    const div =
        document.createElement("div");

    div.textContent =
        String(value);

    return div.innerHTML;
}

function escapeAttribute(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}


/* =========================================
   AVATAR
========================================= */

function createEmojiAvatar(emoji) {
    return {
        type: "emoji",
        value: emoji
    };
}

function avatarContent(avatar) {
    if (typeof avatar === "string") {
        return escapeHtml(avatar);
    }

    if (
        avatar &&
        avatar.type === "photo"
    ) {
        return `
            <img
                src="${escapeAttribute(
                    avatar.value
                )}"
                alt="Player photo"
            >
        `;
    }

    return escapeHtml(
        avatar?.value || "😎"
    );
}


/* =========================================
   THEME
========================================= */

function loadTheme() {
    const saved =
        localStorage.getItem(
            THEME_KEY
        );

    applyTheme(
        saved === "light"
            ? "light"
            : "dark"
    );
}

function applyTheme(theme) {
    const safeTheme =
        theme === "light"
            ? "light"
            : "dark";

    document.body.dataset.theme =
        safeTheme;

    localStorage.setItem(
        THEME_KEY,
        safeTheme
    );

    const meta =
        document.querySelector(
            'meta[name="theme-color"]'
        );

    if (meta) {
        meta.setAttribute(
            "content",
            safeTheme === "light"
                ? "#f4f5f7"
                : "#0f1115"
        );
    }

    updateThemeButtons();
}

function updateThemeButtons() {
    const dark =
        document.getElementById(
            "darkThemeButton"
        );

    const light =
        document.getElementById(
            "lightThemeButton"
        );

    if (!dark || !light) return;

    const theme =
        document.body.dataset.theme;

    dark.classList.toggle(
        "active",
        theme === "dark"
    );

    light.classList.toggle(
        "active",
        theme === "light"
    );
}


/* =========================================
   OVERLAY
========================================= */

function openOverlay(id) {
    document
        .getElementById(id)
        .classList
        .remove("hidden");
}

function closeOverlay(id) {
    document
        .getElementById(id)
        .classList
        .add("hidden");
}

function showMessage(title, text) {
    document.getElementById(
        "messageTitle"
    ).textContent = title;

    document.getElementById(
        "messageText"
    ).textContent = text;

    openOverlay("messageOverlay");
}


/* =========================================
   SETUP
========================================= */

function initializeSetupData() {
    setupPlayerData = [];

    for (
        let i = 0;
        i < MAX_PLAYERS;
        i++
    ) {
        setupPlayerData.push({
            name: `Player ${i + 1}`,
            money: 100,

            avatar:
                createEmojiAvatar(
                    AVATARS[
                        i % AVATARS.length
                    ]
                )
        });
    }

    setupPlayerCount = 3;
}

function loadCurrentGameIntoSetup() {
    if (!game) return;

    setupPlayerCount =
        game.players.length;

    setupPlayerData = [];

    for (
        let i = 0;
        i < MAX_PLAYERS;
        i++
    ) {
        if (i < game.players.length) {
            const player =
                game.players[i];

            setupPlayerData.push({
                name:
                    player.name,

                money:
                    player.startingBalance,

                avatar:
                    clone(player.avatar)
            });

        } else {
            setupPlayerData.push({
                name:
                    `Player ${i + 1}`,

                money: 100,

                avatar:
                    createEmojiAvatar(
                        AVATARS[
                            i % AVATARS.length
                        ]
                    )
            });
        }
    }

    document.getElementById(
        "initialPot"
    ).value = game.initialPot;

    document.getElementById(
        "roundPot"
    ).value = game.rules.roundPot;

    document.getElementById(
        "currency"
    ).value = game.currency;

    renderSetupPlayers();
}

function captureSetupInputs() {
    for (
        let i = 0;
        i < setupPlayerCount;
        i++
    ) {
        const name =
            document.getElementById(
                `setupName${i}`
            );

        const moneyInput =
            document.getElementById(
                `setupMoney${i}`
            );

        if (name) {
            setupPlayerData[i].name =
                name.value;
        }

        if (moneyInput) {
            setupPlayerData[i].money =
                moneyInput.value;
        }
    }
}

function renderSetupPlayers() {
    const container =
        document.getElementById(
            "setupPlayers"
        );

    document.getElementById(
        "playerCountDisplay"
    ).textContent =
        setupPlayerCount;

    container.innerHTML = "";

    for (
        let i = 0;
        i < setupPlayerCount;
        i++
    ) {
        const player =
            setupPlayerData[i];

        const card =
            document.createElement("div");

        card.className =
            "setup-card";

        card.innerHTML = `
            <div class="setup-player-header">

                <div class="setup-avatar-wrapper">

                    <button
                        type="button"
                        class="setup-avatar-button"
                        data-avatar-player="${i}"
                    >
                        ${avatarContent(
                            player.avatar
                        )}
                    </button>

                    <div class="avatar-edit-badge">
                        📷
                    </div>

                </div>

                <h3>
                    Player ${i + 1}
                </h3>

            </div>

            <div class="field">

                <label>Name</label>

                <input
                    id="setupName${i}"
                    value="${escapeAttribute(
                        player.name
                    )}"
                    autocomplete="off"
                >

            </div>

            <div class="field">

                <label>
                    Starting Money
                </label>

                <input
                    id="setupMoney${i}"
                    class="select-on-focus"
                    type="number"
                    inputmode="decimal"
                    min="0"
                    step="1"
                    value="${escapeAttribute(
                        player.money
                    )}"
                >

            </div>
        `;

        container.appendChild(card);
    }

    document
        .querySelectorAll(
            "[data-avatar-player]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                function () {

                    captureSetupInputs();

                    openAvatarPicker(
                        Number(
                            this.dataset
                                .avatarPlayer
                        )
                    );
                }
            );
        });

    activateSelectOnFocus();
}

function changePlayerCount(change) {
    captureSetupInputs();

    setupPlayerCount =
        Math.max(
            MIN_PLAYERS,
            Math.min(
                MAX_PLAYERS,
                setupPlayerCount + change
            )
        );

    renderSetupPlayers();
}


/* =========================================
   SELECT INPUT
========================================= */

function activateSelectOnFocus() {
    document
        .querySelectorAll(
            ".select-on-focus"
        )
        .forEach(input => {

            if (
                input.dataset
                    .selectReady === "1"
            ) {
                return;
            }

            input.dataset.selectReady =
                "1";

            input.addEventListener(
                "focus",
                function () {

                    const element = this;

                    setTimeout(
                        () => {
                            try {
                                element.select();
                            } catch {}
                        },
                        0
                    );
                }
            );

            input.addEventListener(
                "click",
                function () {
                    try {
                        this.select();
                    } catch {}
                }
            );
        });
}


/* =========================================
   AVATAR PICKER
========================================= */

function openAvatarPicker(playerIndex) {
    avatarEditingPlayer =
        playerIndex;

    const container =
        document.getElementById(
            "avatarChoices"
        );

    container.innerHTML = "";

    const current =
        setupPlayerData[
            playerIndex
        ].avatar;

    AVATARS.forEach(emoji => {

        const button =
            document.createElement(
                "button"
            );

        button.type = "button";

        button.className =
            "avatar-picker-button";

        if (
            current?.type === "emoji" &&
            current.value === emoji
        ) {
            button.classList.add(
                "selected"
            );
        }

        button.textContent = emoji;

        button.addEventListener(
            "click",
            function () {

                setupPlayerData[
                    avatarEditingPlayer
                ].avatar =
                    createEmojiAvatar(
                        emoji
                    );

                closeOverlay(
                    "avatarOverlay"
                );

                avatarEditingPlayer =
                    null;

                renderSetupPlayers();
            }
        );

        container.appendChild(
            button
        );
    });

    openOverlay("avatarOverlay");
}

function resizePlayerPhoto(file) {
    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();

            reader.onload =
                function (event) {

                    const image =
                        new Image();

                    image.onload =
                        function () {

                            const size = 320;

                            const canvas =
                                document.createElement(
                                    "canvas"
                                );

                            canvas.width = size;
                            canvas.height = size;

                            const ctx =
                                canvas.getContext(
                                    "2d"
                                );

                            const sourceSize =
                                Math.min(
                                    image.width,
                                    image.height
                                );

                            const sourceX =
                                (
                                    image.width -
                                    sourceSize
                                ) / 2;

                            const sourceY =
                                (
                                    image.height -
                                    sourceSize
                                ) / 2;

                            ctx.drawImage(
                                image,

                                sourceX,
                                sourceY,

                                sourceSize,
                                sourceSize,

                                0,
                                0,

                                size,
                                size
                            );

                            resolve(
                                canvas.toDataURL(
                                    "image/jpeg",
                                    0.72
                                )
                            );
                        };

                    image.onerror =
                        reject;

                    image.src =
                        event.target.result;
                };

            reader.onerror = reject;

            reader.readAsDataURL(file);
        }
    );
}


/* =========================================
   NAVIGATION
========================================= */

function showGame() {
    editingExistingGame = false;

    document
        .getElementById("setupScreen")
        .classList.add("hidden");

    document
        .getElementById("gameScreen")
        .classList.remove("hidden");

    renderGame();
}

function showFreshSetup() {
    editingExistingGame = false;

    document.getElementById(
        "setupTitle"
    ).textContent = "New Game";

    document.getElementById(
        "setupSubtitle"
    ).textContent =
        "Set your players and starting money.";

    document.getElementById(
        "startGameButton"
    ).textContent = "START GAME";

    document.getElementById(
        "backToGameButton"
    ).classList.add("hidden");

    document
        .getElementById("gameScreen")
        .classList.add("hidden");

    document
        .getElementById("setupScreen")
        .classList.remove("hidden");

    renderSetupPlayers();
}

function showEditPlayersSetup() {
    if (!game) return;

    editingExistingGame = true;

    loadCurrentGameIntoSetup();

    document.getElementById(
        "setupTitle"
    ).textContent =
        "New Game / Edit Players";

    document.getElementById(
        "setupSubtitle"
    ).textContent =
        "Change players, pictures or starting money. Your current game stays safe until you start the new game.";

    document.getElementById(
        "startGameButton"
    ).textContent =
        "START NEW GAME";

    document.getElementById(
        "backToGameButton"
    ).classList.remove("hidden");

    document
        .getElementById("gameScreen")
        .classList.add("hidden");

    document
        .getElementById("setupScreen")
        .classList.remove("hidden");
}


/* =========================================
   POT
========================================= */

function calculatePotLevel() {
    if (!game) return 0;

    const initial =
        game.initialPot *
        game.players.length;

    const oneRound =
        game.rules.roundPot *
        game.players.length;

    const visualMaximum =
        Math.max(
            initial + oneRound * 8,
            1
        );

    if (game.pot <= 0) {
        return 0;
    }

    return Math.min(
        100,
        Math.max(
            5,
            (
                game.pot /
                visualMaximum
            ) * 100
        )
    );
}

function renderPot() {
    if (!game) return;

    const level =
        calculatePotLevel();

    const pending =
        getPendingPotTotal();

    document.getElementById(
        "potDisplay"
    ).textContent =
        money(game.pot);

    document.getElementById(
        "potMeterFill"
    ).style.width =
        `${level}%`;

    document.getElementById(
        "potFill"
    ).style.height =
        `${level}%`;

    document.getElementById(
        "potCoins"
    ).style.bottom =
        `${Math.min(
            47,
            5 + level * 0.42
        )}px`;

    let status =
        "POT STARTED";

    if (game.finished) {
        status =
            "🏁 GAME FINISHED";
    }

    else if (level >= 90) {
        status =
            "🔥 POT IS HUGE";
    }

    else if (level >= 65) {
        status =
            "🔥 POT GETTING BIG";
    }

    else if (level >= 35) {
        status =
            "POT GROWING";
    }

    if (
        !game.finished &&
        pending > 0
    ) {
        status +=
            ` • +${money(
                pending
            )} PENDING`;
    }

    document.getElementById(
        "potStatus"
    ).textContent =
        status;
}


/* =========================================
   DEBT UI
========================================= */

function playerDebtHtml(player) {
    if (
        !player.debts ||
        player.debts.length === 0
    ) {
        return "";
    }

    const rows = [];

    player.debts.forEach(debt => {

        if (num(debt.amount) <= 0) {
            return;
        }

        let icon = "•";
        let label = "Pending";

        if (debt.type === "pot") {
            icon = "🪙";
            label = "Pot";
        }

        else if (
            debt.type === "player"
        ) {
            icon = "👤";

            const creditor =
                game.players[
                    debt.playerIndex
                ];

            label =
                creditor
                    ? creditor.name
                    : "Player";
        }

        else if (
            debt.type === "legacy"
        ) {
            label =
                debt.label ||
                "Previous balance";
        }

        rows.push(`
            <div class="pending-row">

                <span class="pending-label">
                    ${icon}
                    ${escapeHtml(label)}
                </span>

                <span class="pending-amount">
                    ${money(debt.amount)}
                </span>

            </div>
        `);
    });

    if (rows.length === 0) {
        return "";
    }

    return `
        <div class="player-pending">

            <div class="pending-title">
                PENDING
            </div>

            ${rows.join("")}

        </div>
    `;
}


/* =========================================
   FINISHED BANNER
========================================= */

function renderFinishedBanner() {
    const banner =
        document.getElementById(
            "gameFinishedBanner"
        );

    if (!banner) return;

    if (!game.finished) {
        banner.classList.add("hidden");
        return;
    }

    const winner =
        game.players[
            game.finishedBy
        ];

    document.getElementById(
        "finishedWinnerAvatar"
    ).innerHTML =
        avatarContent(winner.avatar);

    document.getElementById(
        "finishedWinnerName"
    ).textContent =
        `${winner.name} won the pot`;

    document.getElementById(
        "finishedPotAmount"
    ).textContent =
        money(game.finishedPot);

    banner.classList.remove("hidden");
    renderFinalSettlement();
}


/* =========================================
   GAME
========================================= */

const expandedPlayerDetails = new Set();

function renderGame() {
    if (!game) return;

    ensureDebtState();

    document.getElementById(
        "roundDisplay"
    ).textContent =
        game.round;

    renderPot();
    renderFinishedBanner();

    const quickPayButton =
        document.getElementById(
            "quickPayButton"
        );

    if (quickPayButton) {
        quickPayButton.classList.toggle(
            "hidden",
            game.finished
        );
    }

    const container =
        document.getElementById(
            "playersContainer"
        );

    container.innerHTML = "";

    game.players.forEach(
        (player, index) => {

            const card =
                document.createElement(
                    "div"
                );

            card.className = "player";

            card.dataset.playerCard =
                index;

            if (player.streak > 0) {
                card.classList.add(
                    "current-streak"
                );
            }

            if (player.balance < 0) {
                card.classList.add(
                    "player-negative"
                );
            }

            const streak =
                player.streak > 0
                    ? `
                        <div class="streak">
                            🔥 ${player.streak}
                        </div>
                    `
                    : "";

            const outstandingTotal = roundMoney((player.debts || []).reduce((sum, debt) => sum + Math.max(0, Number(debt.amount) || 0), 0));
            const debtHtml = outstandingTotal > 0
                ? `<div class="player-pending player-pending-compact" aria-label="Outstanding debt ${money(outstandingTotal)}"><span>Pending</span><strong>${money(outstandingTotal)}</strong></div>`
                : "";
            const showDetails = localStorage.getItem("tongitsShowBreakdown") !== "false";
            const detailsExpanded = expandedPlayerDetails.has(index);

            card.innerHTML = `
                <div class="player-top">
                    ${showDetails ? `<button type="button" class="player-details-toggle" data-details-player="${index}" aria-expanded="${detailsExpanded}" aria-controls="player-details-${index}" aria-label="${detailsExpanded ? "Hide" : "Show"} payment details for ${escapeHtml(player.name)}" title="Payment details">▤ <span class="details-chevron">⌄</span></button>` : ""}

                    <div class="player-avatar">
                        ${avatarContent(
                            player.avatar
                        )}
                    </div>

                    <div class="player-info">

                        <div class="player-name">
                            ${escapeHtml(
                                player.name
                            )}
                        </div>

                        ${streak}

                    </div>

                </div>

                <div class="
                    balance
                    ${
                        player.balance < 0
                            ? "negative-balance"
                            : ""
                    }
                ">
                    ${money(
                        player.balance
                    )}
                </div>

                ${debtHtml}
                ${showDetails ? `<div id="player-details-${index}" class="player-details-collapse ${detailsExpanded ? "expanded" : ""}"><div class="player-details-inner">${playerPaymentDetailsHtml(index)}</div></div>` : ""}

                ${
                    game.finished
                        ? `
                            <div class="game-over-player-label">
                                FINAL BALANCE
                            </div>
                        `
                        : `
                            <button
                                class="win-button"
                                type="button"
                                data-win-player="${index}"
                            >
                                🏆 WIN
                            </button>
                        `
                }
            `;

            container.appendChild(card);
        }
    );

    if (!game.finished) {
        document
            .querySelectorAll(
                "[data-win-player]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    function () {

                        chooseWinner(
                            Number(
                                this.dataset
                                    .winPlayer
                            )
                        );
                    }
                );
            });
    }

    document.getElementById(
        "undoButton"
    ).disabled =
        !game.undoStack ||
        game.undoStack.length === 0;

    if (typeof runPostRenderEasterEggs === "function") {
        setTimeout(runPostRenderEasterEggs, 0);
    }
}


/* =========================================
   WINNER
========================================= */

function chooseWinner(index) {
    if (game.finished) return;

    selectedWinner = index;
    pendingRound = null;

    const player =
        game.players[index];

    document.getElementById(
        "winnerAvatar"
    ).innerHTML =
        avatarContent(
            player.avatar
        );

    document.getElementById(
        "winnerTitle"
    ).textContent =
        `${player.name} Won`;

    openOverlay("winOverlay");
}


/* =========================================
   ROUND CONFIRMATION
========================================= */

function showRoundConfirmation() {
    const winner =
        game.players[
            pendingRound.winner
        ];

    document.getElementById(
        "confirmRoundTitle"
    ).textContent =
        `${winner.name} — ${pendingRound.type}`;

    selectedRoundBonuses = (pendingRound.bonuses || []).map(b=>({...b,targets:[...b.targets]}));
    updateRoundBonusUI();

    renderRoundSummary();

    openOverlay(
        "confirmRoundOverlay"
    );
    // The same multi-bonus selector is available after Fight, Draw and Tongits.
    const roundModal = document.querySelector("#confirmRoundOverlay .modal");
    if (roundModal) roundModal.scrollTop = 0;
}

function renderRoundSummary() {
    if (!pendingRound) return;

    const winner =
        game.players[
            pendingRound.winner
        ];

    let html = `
        <div class="summary-title">
            Payments to
            ${escapeHtml(
                winner.name
            )}
        </div>
    `;

    pendingRound.payments.forEach(
        payment => {

            const loser =
                game.players[
                    payment.from
                ];

            html += `
                <div class="summary-row">

                    <div class="summary-label">
                        ${escapeHtml(
                            loser.name
                        )}
                    </div>

                    <div class="summary-value">
                        ${money(
                            payment.amount
                        )}
                    </div>

                </div>
            `;

            if (
                pendingRound.bonusEnabled &&
                payment.bonusAmount > 0
            ) {
                html += `
                    <div class="summary-sub-row">
                        ${money(
                            payment.baseAmount
                        )}
                        base
                        +
                        ${money(
                            payment.bonusAmount
                        )}
                        ${escapeHtml((payment.appliedBonuses || []).map(b=>b.name).join(" + ") || pendingRound.bonusReason || "Bonus")}
                    </div>
                `;
            }
        }
    );

    if (pendingRound.bonusEnabled) {
        html += `<div class="bonus-summary">🎁 ${pendingRound.bonuses.map(b=>`${escapeHtml(b.name)}: ${money(b.amount)} / affected player`).join(' · ')}</div>`;
    }

    html += `
        <div class="summary-row">

            <div class="summary-label">
                Next Round Pot
            </div>

            <div class="summary-value">
                ${money(
                    game.rules.roundPot
                )}
                ×
                ${game.players.length}
            </div>

        </div>
    `;

    document.getElementById(
        "roundSummary"
    ).innerHTML = html;
}


/* =========================================
   POT CONFIRMATION
========================================= */

function showPotConfirmation() {
    const winner =
        game.players[
            pendingRound.winner
        ];

    document.getElementById(
        "potWinTitle"
    ).textContent =
        `${winner.streak} Consecutive Wins!`;

    document.getElementById(
        "potWinAvatar"
    ).innerHTML =
        avatarContent(
            winner.avatar
        );

    document.getElementById(
        "potWinPlayerName"
    ).textContent =
        winner.name;

    document.getElementById(
        "potClaimAmount"
    ).textContent =
        money(
            pendingRound.potBefore
        );

    openOverlay("potWinOverlay");
}


/* =========================================
   GAME FINISHED
========================================= */

function showGameFinished(result) {
    const winner =
        game.players[
            result.winnerIndex
        ];

    document.getElementById(
        "gameFinishedAvatar"
    ).innerHTML =
        avatarContent(
            winner.avatar
        );

    document.getElementById(
        "gameFinishedTitle"
    ).textContent =
        `${winner.name} Won the Pot!`;

    document.getElementById(
        "gameFinishedPot"
    ).textContent =
        money(result.potWon);

    renderFinalSettlement();
    openOverlay(
        "gameFinishedOverlay"
    );

    if (game.easterPrediction) {
        const predicted = game.easterPrediction.playerIndex;
        setTimeout(() => {
            if (predicted === result.winnerIndex) {
                if (typeof eggToast === "function") eggToast("🔮 THE PROPHECY WAS FULFILLED!", 3500);
                if (typeof playSoundEffect === "function") playSoundEffect("potwin");
            } else {
                if (typeof eggToast === "function") eggToast("🔮 The prophecy was wrong. We never speak of this again.", 3800);
                if (typeof playSoundEffect === "function") playSoundEffect("magic");
            }
        }, 450);
    }
}


/* =========================================
   FIGHT
========================================= */

function buildFight() {
    fightSelectedPlayers = [];
    fightAmounts = {};
    sunogSelectedPlayers = [];
    renderFightPlayers();
}

function renderFightPlayers() {
    const container = document.getElementById("fightPlayers");
    const opponents = game.players
        .map((player, index) => ({ player, index }))
        .filter(item => item.index !== selectedWinner);

    container.innerHTML = `
        <div class="quick-pay-section-title">WHO FOUGHT?</div>
        <div class="player-select-grid fight-select-grid">
            ${opponents.map(({ player, index }) => `
                <button type="button" class="player-select-button ${fightSelectedPlayers.includes(index) ? "selected" : ""}"
                    data-fight-player="${index}" aria-pressed="${fightSelectedPlayers.includes(index)}">
                    <span class="player-select-avatar">${avatarContent(player.avatar)}</span>
                    <span class="player-select-name">${escapeHtml(player.name)}</span>
                </button>`).join("")}
        </div>
        <div class="fight-payment-list">
            ${opponents.map(({ player, index }) => fightSelectedPlayers.includes(index) ? `
                <div class="ios-list-row fight-amount-row">
                    <div><strong>${escapeHtml(player.name)}</strong><div class="ios-row-note">Fight payment</div></div>
                    <input id="fightAmount${index}" class="select-on-focus fight-inline-input" type="number" inputmode="decimal" min="0" step="1" placeholder="Amount" value="${escapeAttribute(fightAmounts[index] ?? "")}">
                </div>` : `
                <div class="ios-list-row fight-default-row">
                    <div><strong>${escapeHtml(player.name)}</strong><div class="ios-row-note">Did not fight</div></div>
                    <strong>${money(game.rules.drawPayment)}</strong>
                </div>`).join("")}
        </div>`;

    container.querySelectorAll("[data-fight-player]").forEach(button => {
        button.addEventListener("click", () => {
            document.querySelectorAll(".fight-inline-input").forEach(input => {
                const idx = Number(input.id.replace("fightAmount", ""));
                fightAmounts[idx] = input.value;
            });
            const index = Number(button.dataset.fightPlayer);
            if (fightSelectedPlayers.includes(index)) {
                fightSelectedPlayers = fightSelectedPlayers.filter(i => i !== index);
            } else {
                fightSelectedPlayers.push(index);
            }
            renderFightPlayers();
        });
    });

    container.querySelectorAll(".fight-inline-input").forEach(input => {
        input.addEventListener("input", () => {
            const idx = Number(input.id.replace("fightAmount", ""));
            fightAmounts[idx] = input.value;
        });
    });
    activateSelectOnFocus();
}


/* =========================================
   QUICK PAY
========================================= */

function openQuickPay() {
    if (!game || game.finished) return;
    quickPayReceiverIndex = null;
    quickPaySelectedPayers = [];
    document.getElementById("quickPayAmount").value = 1;
    document.getElementById("quickPayReason").value = "Sagasa";
    renderQuickPaySelectors();
    openOverlay("quickPayOverlay");
    activateSelectOnFocus();
}

function renderQuickPaySelectors() {
    const receivers = document.getElementById("quickPayReceivers");
    const payers = document.getElementById("quickPayPayers");

    receivers.innerHTML = game.players.map((player, index) => `
        <button type="button" class="player-select-button ${quickPayReceiverIndex === index ? "selected receiver-selected" : ""}"
            data-quick-receiver="${index}" aria-pressed="${quickPayReceiverIndex === index}">
            <span class="player-select-avatar">${avatarContent(player.avatar)}</span>
            <span class="player-select-name">${escapeHtml(player.name)}</span>
        </button>`).join("");

    if (quickPayReceiverIndex === null) {
        payers.innerHTML = '<div class="selection-hint">Choose who receives first.</div>';
    } else {
        payers.innerHTML = `<div class="player-select-grid">${game.players.map((player, index) => {
            if (index === quickPayReceiverIndex) return "";
            const selected = quickPaySelectedPayers.includes(index);
            return `<button type="button" class="player-select-button ${selected ? "selected" : ""}" data-quick-payer="${index}" aria-pressed="${selected}">
                <span class="player-select-avatar">${avatarContent(player.avatar)}</span>
                <span class="player-select-name">${escapeHtml(player.name)}</span>
            </button>`;
        }).join("")}</div>`;
    }

    receivers.querySelectorAll("[data-quick-receiver]").forEach(button => {
        button.addEventListener("click", () => {
            quickPayReceiverIndex = Number(button.dataset.quickReceiver);
            quickPaySelectedPayers = game.players.map((_, i) => i).filter(i => i !== quickPayReceiverIndex);
            renderQuickPaySelectors();
        });
    });

    payers.querySelectorAll("[data-quick-payer]").forEach(button => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.quickPayer);
            if (quickPaySelectedPayers.includes(index)) {
                quickPaySelectedPayers = quickPaySelectedPayers.filter(i => i !== index);
            } else {
                quickPaySelectedPayers.push(index);
            }
            renderQuickPaySelectors();
        });
    });
}


/* =========================================
   RULES
========================================= */

function openRules() {
    const r = game.rules;

    document.getElementById(
        "rulesList"
    ).innerHTML = `

        <div class="rule-card">
            <div class="rule-title">
                Draw
            </div>

            <div class="rule-description">
                Each loser pays
                ${money(r.drawPayment)}.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Tongits
            </div>

            <div class="rule-description">
                Each loser pays
                ${money(r.tongitsPayment)}.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Fight
            </div>

            <div class="rule-description">
                Fighters pay the manually entered amount.
                Non-fighters pay
                ${money(r.drawPayment)}.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Bonus
            </div>

            <div class="rule-description">
                Default reason: ${escapeHtml(r.bonusReason || "Bonus")}.
                Default amount: ${money(r.bonusAmount)} per opponent.
                Both can be changed for an individual round before confirming it.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Quick Pay / Sagasa
            </div>

            <div class="rule-description">
                Quick Pay can transfer a custom
                amount from selected players to
                another player without ending the
                round or changing the streak.
                Sagasa defaults to ${money(1)}
                per selected player.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Initial Pot
            </div>

            <div class="rule-description">
                ${money(game.initialPot)}
                per player.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Round Pot
            </div>

            <div class="rule-description">
                ${money(r.roundPot)}
                per player after every completed
                round while the game continues.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Pending Payments
            </div>

            <div class="rule-description">
                If a player cannot fully pay,
                the unpaid amount remains pending.
                Future money received automatically
                settles pending amounts first.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Pot Streak
            </div>

            <div class="rule-description">
                At ${r.potWinStreak}
                consecutive wins, the app asks
                whether the winner takes the pot.
            </div>
        </div>

        <div class="rule-card">
            <div class="rule-title">
                Winning the Pot
            </div>

            <div class="rule-description">
                Taking the pot ends the game.
                No new round contribution is collected.
            </div>
        </div>
    `;

    openOverlay("rulesOverlay");
}


/* =========================================
   SETTINGS
========================================= */

function openSettings() {
    document.getElementById(
        "settingDrawPayment"
    ).value =
        game.rules.drawPayment;

    document.getElementById(
        "settingTongitsPayment"
    ).value =
        game.rules.tongitsPayment;

    editedBonusTypes = JSON.parse(JSON.stringify(game.rules.bonusTypes || []));
    renderBonusTypeSettings();



    document.getElementById(
        "settingInitialPot"
    ).value =
        game.initialPot;

    document.getElementById(
        "settingRoundPot"
    ).value =
        game.rules.roundPot;

    document.getElementById(
        "settingPotStreak"
    ).value =
        game.rules.potWinStreak;

    const sunog = document.getElementById("settingSunogExtra");

    const breakdown = document.getElementById("settingPaymentBreakdown");
    if (breakdown) { breakdown.checked = localStorage.getItem("tongitsShowBreakdown") !== "false"; }
    updateThemeButtons();
    if (typeof updateSoundSettingButtons === "function") updateSoundSettingButtons();

    openOverlay("settingsOverlay");
    const status=document.getElementById("storageStatus");
    if(status) {
        status.textContent=lastSaveOK ? "Last save: successful" : "⚠️ Last save failed";
        if(navigator.storage?.estimate) navigator.storage.estimate().then(e=>{status.textContent += ` · Device site storage: ${(e.usage/1048576).toFixed(1)} MB used`;}).catch(()=>{});
    }
    activateSelectOnFocus();
}


/* =========================================
   HISTORY
========================================= */

function openHistory() {
    const container =
        document.getElementById(
            "historyList"
        );

    container.innerHTML = "";

    if (
        !game.history ||
        game.history.length === 0
    ) {
        container.innerHTML = `
            <div class="history-empty">
                No activity yet.
            </div>
        `;

        openOverlay(
            "historyOverlay"
        );

        return;
    }

    [...game.history]
        .reverse()
        .forEach(entry => {

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                `history-item${entry.undone ? " undone" : ""}`;

            const undoneBadge = entry.undone
                ? `<div class="history-undone-badge">↶ UNDONE</div>`
                : "";


            /* QUICK PAY */

            if (
                entry.eventType ===
                "quickPay"
            ) {
                const payments =
                    (entry.payments || [])
                        .map(payment => {

                            let text = `
                                ${escapeHtml(
                                    payment.from
                                )}
                                → ${money(
                                    payment.amount
                                )}
                            `;

                            if (
                                payment.pending > 0
                            ) {
                                text += `
                                    (${money(
                                        payment.paid
                                    )} paid,
                                    ${money(
                                        payment.pending
                                    )} pending)
                                `;
                            }

                            return `
                                <div>
                                    ${text}
                                </div>
                            `;
                        })
                        .join("");

                item.innerHTML = `
                    ${undoneBadge}
                    <div class="history-header">

                        <div class="history-round">
                            Round ${entry.round}
                        </div>

                        <div class="history-type">
                            💸 QUICK PAY
                        </div>

                    </div>

                    <div class="history-winner">

                        <span class="history-avatar">
                            ${avatarContent(
                                entry.winnerAvatar
                            )}
                        </span>

                        ${escapeHtml(
                            entry.winner
                        )}

                    </div>

                    <div class="quick-pay-history-reason">
                        ${escapeHtml(
                            entry.reason ||
                            "Quick Pay"
                        )}
                    </div>

                    <div class="history-details">
                        ${payments}
                    </div>
                `;

                container.appendChild(
                    item
                );

                return;
            }


            /* NORMAL ROUND */

            const payments =
                (entry.payments || [])
                    .map(payment => {

                        let detail = `
                            ${escapeHtml(
                                payment.from
                            )}
                            owed
                            ${money(
                                payment.amount
                            )}
                        `;

                        if (
                            payment.bonusAmount > 0
                        ) {
                            detail += `
                                (${money(
                                    payment.baseAmount
                                )}
                                +
                                ${money(
                                    payment.bonusAmount
                                )}
                                ${escapeHtml(pendingRound.bonusReason || "Bonus")})
                            `;
                        }

                        if (
                            payment.pending > 0
                        ) {
                            detail += `
                                —
                                ${money(
                                    payment.paid
                                )}
                                paid,
                                ${money(
                                    payment.pending
                                )}
                                pending
                            `;
                        } else {
                            detail += ` — paid`;
                        }

                        return `
                            ${detail}
                            <br>
                        `;
                    })
                    .join("");

            let bonusText = "";

            if (entry.bonusEnabled) {
                bonusText = `
                    <div class="history-bonus">
                        🎁 ${Array.isArray(entry.bonuses) && entry.bonuses.length ? entry.bonuses.map(b=>`${escapeHtml(b.name)} +${money(b.amount)} (${b.targets.length} affected)`).join(" · ") : `${escapeHtml(entry.bonusReason || "Bonus")} +${money(entry.bonusAmount)} per opponent`}
                    </div>
                `;
            }

            let potText = "";

            if (entry.potWon > 0) {
                potText = `
                    <div class="history-pot-won">
                        🔥 Took funded pot:
                        ${money(
                            entry.potWon
                        )}
                    </div>
                `;

                if (
                    entry.pendingPotTransferred >
                    0
                ) {
                    potText += `
                        <div class="history-pot-won">
                            + ${money(
                                entry.pendingPotTransferred
                            )}
                            pending pot payments
                            transferred to winner
                        </div>
                    `;
                }

                potText += `
                    <div class="history-game-ended">
                        🏁 Game finished
                    </div>
                `;
            }

            else if (
                entry.potDecisionRequired
            ) {
                potText = `
                    <div class="history-pot-won">
                        🔥 Pot kept — game continued
                    </div>
                `;
            }

            let pendingPotText = "";

            if (
                entry.potPendingAfter > 0
            ) {
                pendingPotText = `
                    <br>
                    Pending to pot:
                    ${money(
                        entry.potPendingAfter
                    )}
                `;
            }

            const contributionText =
                entry.gameFinished
                    ? `
                        <br>
                        No next-round pot contribution.
                    `
                    : `
                        <br>
                        Round contribution:
                        ${money(
                            entry.roundPot
                        )}
                        per player.
                    `;

            item.innerHTML = `
                    ${undoneBadge}
                <div class="history-header">

                    <div class="history-round">
                        Round ${entry.round}
                    </div>

                    <div class="history-type">
                        ${escapeHtml(
                            entry.type
                        )}
                    </div>

                </div>

                <div class="history-winner">

                    <span class="history-avatar">
                        ${avatarContent(
                            entry.winnerAvatar
                        )}
                    </span>

                    🏆
                    ${escapeHtml(
                        entry.winner
                    )}

                </div>

                ${bonusText}

                <div class="history-details">

                    ${payments}

                    ${contributionText}

                    <br>

                    Funded pot after round:
                    ${money(
                        entry.potAfter
                    )}

                    ${pendingPotText}

                </div>

                ${potText}
            `;

            container.appendChild(
                item
            );
        });

    openOverlay("historyOverlay");
}
/* Detailed game accounting (undone history is excluded). */
function paymentSummaryFor(index) {
    const names = game.players.map(p=>p.name);
    const paid = new Map(), received = new Map();
    const add=(map,name,amount)=>map.set(name,(map.get(name)||0)+Number(amount||0));
    // Initial pot is paid at game creation, not represented by a round entry.
    add(paid,"Pot",Math.min(Number(game.initialPot||0),Number(game.players[index].startingBalance||0)));
    for(const entry of game.history || []) {
        if(entry.undone) continue;
        for(const p of entry.payments || []) {
            const from = p.fromIndex ?? names.indexOf(p.from);
            const to = p.toIndex ?? (entry.eventType === "quickPay" ? (entry.receiverIndex ?? entry.toIndex ?? names.indexOf(entry.receiver || entry.to)) : names.indexOf(entry.winner));
            const amount = Number(p.paid ?? p.amount ?? 0);
            if(from === index) add(paid, names[to] || entry.winner || "Player", amount);
            if(to === index) add(received, names[from] || p.from || "Player", amount);
        }
        for(const c of entry.contributions || []) {
            const who = c.fromIndex ?? c.playerIndex ?? names.indexOf(c.from);
            if(who === index) add(paid,"Pot",Number(c.paid ?? c.amount ?? 0));
        }
        if(entry.gameFinished && Number(entry.potWon)>0 && names.indexOf(entry.winner)===index) add(received,"Pot",Number(entry.potWon));
    }
    return {paid,received};
}
function playerPaymentDetailsHtml(index) {
    const p = game.players[index];
    const summary = paymentSummaryFor(index);
    const total = map => roundMoney(Array.from(map.values()).reduce((a,b)=>a+b,0));
    const rows = map => Array.from(map.entries()).filter(([,v])=>v>0).map(([name,amount])=>`<div class="settlement-row"><span>${escapeHtml(name)}</span><strong>${money(amount)}</strong></div>`).join("") || '<p class="ios-row-note">None yet</p>';
    const debtRows = (p.debts||[]).filter(d=>Number(d.amount)>0).map(d=>`<div class="settlement-row"><span>${d.type==="pot"?"Pot":d.type==="player"?escapeHtml(game.players[d.playerIndex]?.name||"Player"):"Other"}</span><strong>${money(d.amount)}</strong></div>`).join("") || '<p class="ios-row-note">None</p>';
    return `<div class="player-details-section"><strong>Paid out · ${money(total(summary.paid))}</strong>${rows(summary.paid)}</div><div class="player-details-section"><strong>Received · ${money(total(summary.received))}</strong>${rows(summary.received)}</div><div class="player-details-section"><strong>Still owed</strong>${debtRows}</div><p class="ios-row-note">Starting ${money(p.startingBalance)} · Current net ${money(p.balance)}. Recorded actual payments only; older history may be incomplete.</p>`;
}
function computeFinalSettlement() {
    const rows=game.players.map((p,i)=>({index:i,name:p.name,start:Number(p.startingBalance||0),end:Number(p.balance||0),net:roundMoney(Number(p.balance||0)-Number(p.startingBalance||0))}));
    const creditors=rows.filter(p=>p.net>0.005).map(p=>({...p,left:p.net}));
    const debtors=rows.filter(p=>p.net< -0.005).map(p=>({...p,left:-p.net}));
    const transfers=[];
    let a=0,b=0;
    while(a<debtors.length && b<creditors.length) {
        const amount=roundMoney(Math.min(debtors[a].left,creditors[b].left));
        if(amount>0) transfers.push({from:debtors[a].name,to:creditors[b].name,amount});
        debtors[a].left=roundMoney(debtors[a].left-amount);
        creditors[b].left=roundMoney(creditors[b].left-amount);
        if(debtors[a].left<=0.005) a++;
        if(creditors[b].left<=0.005) b++;
    }
    return {rows,transfers,balanced:Math.abs(rows.reduce((n,p)=>n+p.net,0))<0.01};
}
function renderFinalSettlement() {
    const el = document.getElementById("finalSettlementContent");
    const detailsEl = document.getElementById("finalSettlementDetailsContent");
    if (!el || !game?.finished) return;
    const data = computeFinalSettlement();
    const winner = game.players[game.finishedBy];
    el.innerHTML = `<h3>🏆 Final Balances</h3>` +
        data.rows.map(p => `<div class="settlement-row"><span>${escapeHtml(p.name)}<small>Starting ${money(p.start)} · Final ${money(p.end)}</small></span><strong class="${p.net < 0 ? "settlement-loss" : "settlement-profit"}">${p.net > 0 ? "+" : ""}${money(p.net)}</strong></div>`).join("") +
        `<h3>💸 Who Pays Whom?</h3>` +
        (data.transfers.map(t => `<div class="settlement-row"><span>${escapeHtml(t.from)} → ${escapeHtml(t.to)}</span><strong>${money(t.amount)}</strong></div>`).join("") || "<p>No net transfers required.</p>") +
        (!data.balanced ? '<p class="settlement-loss">⚠️ Net balances do not reconcile. Check legacy or outstanding debts before paying.</p>' : '') +
        `<p class="ios-row-note">These are net end-of-game transfers based on the recorded balances, assuming real money has not already been settled separately.</p>`;
    if (detailsEl) {
        detailsEl.innerHTML = data.rows.map(row => {
            const player = game.players[row.index];
            const summary = paymentSummaryFor(row.index);
            const sum = map => roundMoney(Array.from(map.values()).reduce((a,b)=>a+b,0));
            const paidPot = roundMoney(summary.paid.get("Pot") || 0);
            const receivedPot = roundMoney(summary.received.get("Pot") || 0);
            const pendingPot = roundMoney((player.debts || []).filter(d => d.type === "pot").reduce((a,d)=>a+Number(d.amount||0),0));
            const pendingOthers = roundMoney((player.debts || []).filter(d => d.type !== "pot").reduce((a,d)=>a+Number(d.amount||0),0));
            return `<div class="settlement-player-detail"><h4>${escapeHtml(row.name)}</h4>` +
                `<div class="settlement-row"><span>Starting money</span><strong>${money(row.start)}</strong></div>` +
                `<div class="settlement-row"><span>Paid into pot (recorded)</span><strong>${money(paidPot)}</strong></div>` +
                `<div class="settlement-row"><span>Paid to other players (recorded)</span><strong>${money(roundMoney(sum(summary.paid)-paidPot))}</strong></div>` +
                `<div class="settlement-row"><span>Received from players (recorded)</span><strong>${money(roundMoney(sum(summary.received)-receivedPot))}</strong></div>` +
                `<div class="settlement-row"><span>Received from pot (recorded)</span><strong>${money(receivedPot)}</strong></div>` +
                `<div class="settlement-row"><span>Unpaid pot debt remaining</span><strong>${money(pendingPot)}</strong></div>` +
                `<div class="settlement-row"><span>Other outstanding debts</span><strong>${money(pendingOthers)}</strong></div>` +
                `<div class="settlement-row"><span>Final net (including obligations)</span><strong class="${row.net<0?'settlement-loss':'settlement-profit'}">${row.net>0?'+':''}${money(row.net)}</strong></div></div>`;
        }).join("") + `<p class="ios-row-note">Unpaid pot contributions transfer to ${escapeHtml(winner?.name || 'the pot winner')} when the pot is awarded and are included in net balances. The recorded payment categories are informational; older game history may be incomplete. Do not add them again to the final transfers.</p>`;
    }
    const details = document.getElementById("finalSettlementDetails");
    if (details) details.open = false;
}
