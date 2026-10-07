/* =========================================
   DEFAULT RULES
========================================= */

const DEFAULT_RULES = {
    drawPayment: 2,
    tongitsPayment: 4,
    roundPot: 2,
    potWinStreak: 3
};

let game = null;
let selectedWinner = null;
let pendingRound = null;


/* =========================================
   BASIC HELPERS
========================================= */

function num(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function roundMoney(value) {
    return Math.round(
        (num(value) + Number.EPSILON) * 100
    ) / 100;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function money(value) {
    const amount = roundMoney(value);

    const formatted =
        Number.isInteger(amount)
            ? amount.toString()
            : amount.toFixed(2);

    return `${game?.currency || "S$"}${formatted}`;
}


/* =========================================
   DEBT / CASH MODEL
========================================= */

function totalPlayerDebt(player) {
    if (!player?.debts) return 0;

    return roundMoney(
        player.debts.reduce(
            (total, debt) =>
                total + num(debt.amount),
            0
        )
    );
}

function playerNetBalance(player) {
    return roundMoney(
        num(player.cash) -
        totalPlayerDebt(player)
    );
}

function refreshPlayerBalance(player) {
    player.balance =
        playerNetBalance(player);
}

function refreshAllBalances() {
    if (!game?.players) return;

    game.players.forEach(
        refreshPlayerBalance
    );
}


/* =========================================
   MIGRATION
========================================= */

function ensureDebtState() {
    if (!game?.players) return;

    game.players.forEach(player => {

        if (
            player.cash !== undefined &&
            Array.isArray(player.debts)
        ) {
            player.cash =
                Math.max(
                    0,
                    roundMoney(player.cash)
                );

            player.debts =
                player.debts
                    .map(debt => ({
                        ...debt,
                        amount:
                            Math.max(
                                0,
                                roundMoney(
                                    debt.amount
                                )
                            )
                    }))
                    .filter(
                        debt =>
                            debt.amount > 0
                    );

            refreshPlayerBalance(player);
            return;
        }

        const oldBalance =
            roundMoney(player.balance);

        if (oldBalance >= 0) {
            player.cash = oldBalance;
            player.debts = [];
        } else {
            player.cash = 0;

            player.debts = [
                {
                    type: "legacy",
                    label: "Previous balance",
                    amount:
                        Math.abs(oldBalance)
                }
            ];
        }

        refreshPlayerBalance(player);
    });

    /*
        Migration for games created
        before game.finished existed.
    */

    if (game.finished === undefined) {
        game.finished = false;
    }

    if (game.finishedBy === undefined) {
        game.finishedBy = null;
    }

    if (game.finishedPot === undefined) {
        game.finishedPot = 0;
    }

    saveGame();
}


/* =========================================
   DEBT HELPERS
========================================= */

function addDebt(
    debtorIndex,
    debt
) {
    const player =
        game.players[debtorIndex];

    if (!player.debts) {
        player.debts = [];
    }

    const amount =
        roundMoney(debt.amount);

    if (amount <= 0) return;

    let existing = null;

    if (debt.type === "player") {
        existing =
            player.debts.find(
                item =>
                    item.type === "player" &&
                    item.playerIndex ===
                        debt.playerIndex
            );

    } else if (debt.type === "pot") {
        existing =
            player.debts.find(
                item =>
                    item.type === "pot"
            );

    } else if (debt.type === "legacy") {
        existing =
            player.debts.find(
                item =>
                    item.type === "legacy" &&
                    item.label === debt.label
            );
    }

    if (existing) {
        existing.amount =
            roundMoney(
                existing.amount +
                amount
            );
    } else {
        player.debts.push({
            ...debt,
            amount
        });
    }

    refreshPlayerBalance(player);
}

function cleanupDebts(player) {
    player.debts =
        (player.debts || [])
            .filter(
                debt =>
                    roundMoney(
                        debt.amount
                    ) > 0
            );
}


/* =========================================
   SETTLE EXISTING DEBTS
========================================= */

function settlePlayerDebts(
    playerIndex,
    chain = new Set()
) {
    const player =
        game.players[playerIndex];

    if (!player) return;

    if (chain.has(playerIndex)) {
        refreshPlayerBalance(player);
        return;
    }

    const nextChain =
        new Set(chain);

    nextChain.add(playerIndex);

    cleanupDebts(player);

    for (
        let i = 0;
        i < player.debts.length;
        i++
    ) {
        const debt =
            player.debts[i];

        if (player.cash <= 0) {
            break;
        }

        const payment =
            roundMoney(
                Math.min(
                    player.cash,
                    debt.amount
                )
            );

        if (payment <= 0) continue;

        player.cash =
            roundMoney(
                player.cash -
                payment
            );

        debt.amount =
            roundMoney(
                debt.amount -
                payment
            );

        if (debt.type === "pot") {
            game.pot =
                roundMoney(
                    game.pot +
                    payment
                );
        }

        else if (debt.type === "player") {
            const creditor =
                game.players[
                    debt.playerIndex
                ];

            if (creditor) {
                creditor.cash =
                    roundMoney(
                        creditor.cash +
                        payment
                    );

                settlePlayerDebts(
                    debt.playerIndex,
                    nextChain
                );
            }
        }
    }

    cleanupDebts(player);
    refreshAllBalances();
}


/* =========================================
   PLAYER PAYMENT
========================================= */

function payPlayer(
    fromIndex,
    toIndex,
    amount,
    reason
) {
    const from =
        game.players[fromIndex];

    const to =
        game.players[toIndex];

    const required =
        Math.max(
            0,
            roundMoney(amount)
        );

    const paid =
        roundMoney(
            Math.min(
                from.cash,
                required
            )
        );

    const unpaid =
        roundMoney(
            required - paid
        );

    if (paid > 0) {
        from.cash =
            roundMoney(
                from.cash - paid
            );

        to.cash =
            roundMoney(
                to.cash + paid
            );
    }

    if (unpaid > 0) {
        addDebt(
            fromIndex,
            {
                type: "player",
                playerIndex: toIndex,
                amount: unpaid
            }
        );
    }

    if (paid > 0) {
        settlePlayerDebts(toIndex);
    }

    refreshAllBalances();

    return {
        from: fromIndex,
        to: toIndex,
        amount: required,
        paid,
        pending: unpaid,
        reason
    };
}


/* =========================================
   POT CONTRIBUTION
========================================= */

function contributeToPot(
    playerIndex,
    amount
) {
    const player =
        game.players[playerIndex];

    const required =
        Math.max(
            0,
            roundMoney(amount)
        );

    const paid =
        roundMoney(
            Math.min(
                player.cash,
                required
            )
        );

    const pending =
        roundMoney(
            required - paid
        );

    if (paid > 0) {
        player.cash =
            roundMoney(
                player.cash - paid
            );

        game.pot =
            roundMoney(
                game.pot + paid
            );
    }

    if (pending > 0) {
        addDebt(
            playerIndex,
            {
                type: "pot",
                amount: pending
            }
        );
    }

    refreshPlayerBalance(player);

    return {
        playerIndex,
        amount: required,
        paid,
        pending
    };
}


/* =========================================
   PENDING POT
========================================= */

function getPendingPotTotal() {
    if (!game?.players) return 0;

    let total = 0;

    game.players.forEach(player => {
        (player.debts || [])
            .forEach(debt => {
                if (debt.type === "pot") {
                    total +=
                        num(debt.amount);
                }
            });
    });

    return roundMoney(total);
}


/* =========================================
   CREATE GAME
========================================= */

function createGame(
    setupPlayers,
    initialPot,
    roundPot,
    currency
) {
    const initial =
        Math.max(
            0,
            roundMoney(initialPot)
        );

    game = {
        currency:
            currency || "S$",

        initialPot: initial,

        pot: 0,

        round: 1,

        finished: false,
        finishedBy: null,
        finishedPot: 0,

        players:
            setupPlayers.map(
                (player, index) => {

                    const startingBalance =
                        Math.max(
                            0,
                            roundMoney(
                                player.money
                            )
                        );

                    return {
                        name:
                            String(
                                player.name ||
                                `Player ${index + 1}`
                            ),

                        avatar:
                            clone(player.avatar),

                        startingBalance,

                        cash:
                            startingBalance,

                        debts: [],

                        balance:
                            startingBalance,

                        streak: 0
                    };
                }
            ),

        rules: {
            ...DEFAULT_RULES,

            roundPot:
                Math.max(
                    0,
                    roundMoney(roundPot)
                )
        },

        history: [],
        undoStack: [],
        lastWinner: null
    };

    game.players.forEach(
        (player, index) => {
            contributeToPot(
                index,
                initial
            );
        }
    );

    refreshAllBalances();
    saveGame();
}


/* =========================================
   PREPARE ROUND
========================================= */

function prepareNormalRound(type) {
    if (
        selectedWinner === null ||
        selectedWinner === undefined ||
        game.finished
    ) {
        return;
    }

    let paymentAmount = 0;

    if (type === "Tongits") {
        paymentAmount =
            game.rules.tongitsPayment;
    } else {
        paymentAmount =
            game.rules.drawPayment;
    }

    const payments = [];

    game.players.forEach(
        (player, index) => {

            if (
                index ===
                selectedWinner
            ) {
                return;
            }

            payments.push({
                from: index,
                to: selectedWinner,
                amount: paymentAmount,
                reason: type
            });
        }
    );

    pendingRound = {
        type,
        winner: selectedWinner,
        payments
    };
}


/* =========================================
   SNAPSHOT
========================================= */

function createRoundSnapshot() {
    return clone({
        currency: game.currency,
        initialPot: game.initialPot,
        pot: game.pot,
        round: game.round,
        players: game.players,
        rules: game.rules,
        history: game.history,
        lastWinner: game.lastWinner,

        finished: game.finished,
        finishedBy: game.finishedBy,
        finishedPot: game.finishedPot
    });
}


/* =========================================
   BEGIN SETTLEMENT
========================================= */

function beginRoundSettlement() {
    ensureDebtState();

    if (
        !pendingRound ||
        game.finished
    ) {
        return false;
    }

    pendingRound.beforeState =
        createRoundSnapshot();

    pendingRound.potBefore =
        roundMoney(game.pot);

    pendingRound.potPendingBefore =
        getPendingPotTotal();

    pendingRound.historyPayments = [];

    pendingRound.payments.forEach(
        payment => {

            const result =
                payPlayer(
                    payment.from,
                    payment.to,
                    payment.amount,
                    payment.reason
                );

            pendingRound
                .historyPayments
                .push({
                    from:
                        game.players[
                            payment.from
                        ].name,

                    fromIndex:
                        payment.from,

                    amount:
                        result.amount,

                    paid:
                        result.paid,

                    pending:
                        result.pending,

                    reason:
                        payment.reason
                });
        }
    );

    const winner =
        pendingRound.winner;

    if (
        game.lastWinner === winner
    ) {
        game.players[winner].streak += 1;

    } else {
        game.players.forEach(
            player =>
                player.streak = 0
        );

        game.players[winner].streak = 1;
    }

    game.lastWinner = winner;

    refreshAllBalances();

    return (
        game.players[winner].streak >=
        game.rules.potWinStreak
    );
}


/* =========================================
   OLD PENDING POT -> WINNER
========================================= */

function transferPendingPotToWinner(
    winnerIndex
) {
    game.players.forEach(
        (player, index) => {

            if (!player.debts) return;

            let transferAmount = 0;

            player.debts =
                player.debts.filter(
                    debt => {

                        if (
                            debt.type !== "pot"
                        ) {
                            return true;
                        }

                        transferAmount =
                            roundMoney(
                                transferAmount +
                                debt.amount
                            );

                        return false;
                    }
                );

            if (transferAmount <= 0) {
                return;
            }

            /*
                If winner owed money to the
                pot, that unpaid obligation
                disappears because they now
                own the pot.
            */

            if (
                index === winnerIndex
            ) {
                return;
            }

            addDebt(
                index,
                {
                    type: "player",
                    playerIndex:
                        winnerIndex,
                    amount:
                        transferAmount
                }
            );
        }
    );

    refreshAllBalances();
}


/* =========================================
   FINISH ROUND
========================================= */

function finishRound(
    takeExistingPot
) {
    if (!pendingRound) {
        return null;
    }

    const winnerIndex =
        pendingRound.winner;

    const winner =
        game.players[winnerIndex];

    let potWon = 0;

    let transferredPendingPot = 0;

    const potDecisionRequired =
        winner.streak >=
        game.rules.potWinStreak;


    /* =====================================
       YES — POT WON
       THIS ENDS THE GAME
    ===================================== */

    if (takeExistingPot) {

        potWon =
            roundMoney(
                pendingRound.potBefore
            );

        transferredPendingPot =
            roundMoney(
                pendingRound
                    .potPendingBefore || 0
            );

        transferPendingPotToWinner(
            winnerIndex
        );

        winner.cash =
            roundMoney(
                winner.cash +
                game.pot
            );

        game.pot = 0;

        /*
            Pot winner's received cash can
            settle their own existing debt.
        */

        settlePlayerDebts(
            winnerIndex
        );

        game.players.forEach(
            player =>
                player.streak = 0
        );

        game.lastWinner = null;

        /*
            IMPORTANT:
            No new round-pot contribution.

            Winning the pot ends this game.
        */

        game.finished = true;

        game.finishedBy =
            winnerIndex;

        game.finishedPot =
            potWon;


        const historyEntry = {
            round:
                game.round,

            type:
                pendingRound.type,

            winner:
                winner.name,

            winnerAvatar:
                clone(winner.avatar),

            payments:
                clone(
                    pendingRound
                        .historyPayments
                ),

            contributions: [],

            roundPot:
                game.rules.roundPot,

            potBefore:
                pendingRound.potBefore,

            potPendingBefore:
                pendingRound
                    .potPendingBefore || 0,

            potDecisionRequired: true,

            potWon,

            pendingPotTransferred:
                transferredPendingPot,

            potKept: false,

            potAfter: 0,

            potPendingAfter: 0,

            gameFinished: true
        };


        game.history.push(
            historyEntry
        );

        game.undoStack.push(
            pendingRound.beforeState
        );


        const result = {
            winnerName:
                winner.name,

            winnerIndex,

            potWon,

            potAfter: 0,

            potPendingAfter: 0,

            gameFinished: true
        };


        pendingRound = null;
        selectedWinner = null;

        refreshAllBalances();
        saveGame();

        return result;
    }


    /* =====================================
       NO — KEEP POT
       GAME CONTINUES
    ===================================== */

    const contributions = [];

    game.players.forEach(
        (player, index) => {

            contributions.push(
                contributeToPot(
                    index,
                    game.rules.roundPot
                )
            );
        }
    );

    refreshAllBalances();


    const historyEntry = {
        round:
            game.round,

        type:
            pendingRound.type,

        winner:
            winner.name,

        winnerAvatar:
            clone(winner.avatar),

        payments:
            clone(
                pendingRound
                    .historyPayments
            ),

        contributions:
            clone(contributions),

        roundPot:
            game.rules.roundPot,

        potBefore:
            pendingRound.potBefore,

        potPendingBefore:
            pendingRound
                .potPendingBefore || 0,

        potDecisionRequired,

        potWon: 0,

        pendingPotTransferred: 0,

        potKept:
            potDecisionRequired,

        potAfter:
            roundMoney(game.pot),

        potPendingAfter:
            getPendingPotTotal(),

        gameFinished: false
    };


    game.history.push(
        historyEntry
    );

    game.undoStack.push(
        pendingRound.beforeState
    );

    game.round += 1;

    const result = {
        winnerName:
            winner.name,

        winnerIndex,

        potWon: 0,

        potAfter:
            game.pot,

        potPendingAfter:
            getPendingPotTotal(),

        gameFinished: false
    };

    pendingRound = null;
    selectedWinner = null;

    saveGame();

    return result;
}


/* =========================================
   UNDO
========================================= */

function undoLastRound() {
    if (
        !game.undoStack ||
        game.undoStack.length === 0
    ) {
        return false;
    }

    const snapshot =
        game.undoStack.pop();

    const remainingUndoStack =
        game.undoStack;

    game.currency =
        snapshot.currency;

    game.initialPot =
        snapshot.initialPot;

    game.pot =
        snapshot.pot;

    game.round =
        snapshot.round;

    game.players =
        snapshot.players;

    game.rules =
        snapshot.rules;

    game.history =
        snapshot.history;

    game.lastWinner =
        snapshot.lastWinner;

    game.finished =
        snapshot.finished || false;

    game.finishedBy =
        snapshot.finishedBy ??
        null;

    game.finishedPot =
        snapshot.finishedPot || 0;

    game.undoStack =
        remainingUndoStack;

    pendingRound = null;
    selectedWinner = null;

    ensureDebtState();
    refreshAllBalances();

    saveGame();

    return true;
}


/* =========================================
   SETTINGS
========================================= */

function updateGameSettings(settings) {
    game.rules.drawPayment =
        Math.max(
            0,
            roundMoney(
                settings.drawPayment
            )
        );

    game.rules.tongitsPayment =
        Math.max(
            0,
            roundMoney(
                settings.tongitsPayment
            )
        );

    game.rules.roundPot =
        Math.max(
            0,
            roundMoney(
                settings.roundPot
            )
        );

    game.rules.potWinStreak =
        Math.max(
            1,
            Math.floor(
                num(
                    settings.potWinStreak
                )
            )
        );

    game.initialPot =
        Math.max(
            0,
            roundMoney(
                settings.initialPot
            )
        );

    saveGame();
}


/* =========================================
   RESTART — KEEP CURRENT MONEY
========================================= */

function restartKeepMoney() {
    ensureDebtState();

    game.players.forEach(
        player => {

            const currentNet =
                playerNetBalance(player);

            player.startingBalance =
                Math.max(
                    0,
                    currentNet
                );

            player.cash =
                player.startingBalance;

            player.debts = [];

            player.balance =
                player.startingBalance;

            player.streak = 0;
        }
    );

    game.pot = 0;
    game.round = 1;
    game.history = [];
    game.undoStack = [];
    game.lastWinner = null;

    game.finished = false;
    game.finishedBy = null;
    game.finishedPot = 0;

    game.players.forEach(
        (player, index) => {
            contributeToPot(
                index,
                game.initialPot
            );
        }
    );

    refreshAllBalances();
    saveGame();
}


/* =========================================
   RESTART — RESET MONEY
========================================= */

function restartResetMoney() {
    game.players.forEach(
        player => {

            player.cash =
                Math.max(
                    0,
                    roundMoney(
                        player.startingBalance
                    )
                );

            player.debts = [];

            player.balance =
                player.cash;

            player.streak = 0;
        }
    );

    game.pot = 0;
    game.round = 1;
    game.history = [];
    game.undoStack = [];
    game.lastWinner = null;

    game.finished = false;
    game.finishedBy = null;
    game.finishedPot = 0;

    game.players.forEach(
        (player, index) => {
            contributeToPot(
                index,
                game.initialPot
            );
        }
    );

    refreshAllBalances();
    saveGame();
}