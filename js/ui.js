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
}


/* =========================================
   GAME
========================================= */

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

            const debtHtml =
                playerDebtHtml(player);

            card.innerHTML = `
                <div class="player-top">

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

    const bonusReason = pendingRound.bonusReason || game.rules.bonusReason || "Bonus";
    const bonusAmount = pendingRound.bonusEnabled
        ? (pendingRound.bonusAmount ?? game.rules.bonusAmount)
        : game.rules.bonusAmount;

    document.getElementById("bonusReason").value = bonusReason;
    document.getElementById("bonusAmount").value = bonusAmount;

    const bonusDetails = document.getElementById("bonusDetails");
    const bonusButton = document.getElementById("bonusToggleButton");
    bonusDetails.classList.toggle("hidden", !pendingRound.bonusEnabled);
    bonusButton.classList.toggle("selected", Boolean(pendingRound.bonusEnabled));
    bonusButton.setAttribute("aria-pressed", String(Boolean(pendingRound.bonusEnabled)));
    bonusButton.querySelector(".bonus-toggle-hint").textContent =
        pendingRound.bonusEnabled ? "Selected" : "Tap to add";

    renderRoundSummary();

    openOverlay(
        "confirmRoundOverlay"
    );
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
                        ${escapeHtml(pendingRound.bonusReason || "Bonus")}
                    </div>
                `;
            }
        }
    );

    if (pendingRound.bonusEnabled) {
        html += `
            <div class="bonus-summary">
                🎁 ${escapeHtml(pendingRound.bonusReason || "Bonus").toUpperCase()}:
                +${money(
                    pendingRound.bonusAmount
                )}
                from each opponent
            </div>
        `;
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

    openOverlay(
        "gameFinishedOverlay"
    );
}


/* =========================================
   FIGHT
========================================= */

function buildFight() {
    fightSelectedPlayers = [];
    fightAmounts = {};
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

    document.getElementById("settingBonusReason").value = game.rules.bonusReason || "Bonus";

    document.getElementById("settingBonusAmount").value = game.rules.bonusAmount;

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

    updateThemeButtons();

    openOverlay("settingsOverlay");

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
                        🎁 ${escapeHtml(entry.bonusReason || "Bonus")} +${money(entry.bonusAmount)} per opponent
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