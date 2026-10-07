const DEFAULT_RULES = {
    drawPayment: 2,
    tongitsPayment: 4,
    bonusAmount: 2,
    bonusReason: "Quadra",
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
    return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function money(value) {
    const amount = roundMoney(value);

    const formatted = Number.isInteger(amount)
        ? amount.toString()
        : amount.toFixed(2);

    return `${game?.currency || "S$"}${formatted}`;
}


/* =========================================
   DEBT / BALANCE
========================================= */

function totalPlayerDebt(player) {
    if (!player?.debts) return 0;

    return roundMoney(
        player.debts.reduce(
            (total, debt) => total + num(debt.amount),
            0
        )
    );
}

function playerNetBalance(player) {
    return roundMoney(
        num(player.cash) - totalPlayerDebt(player)
    );
}

function refreshPlayerBalance(player) {
    player.balance = playerNetBalance(player);
}

function refreshAllBalances() {
    if (!game?.players) return;

    game.players.forEach(refreshPlayerBalance);
}


/* =========================================
   MIGRATION / OLD SAVED GAMES
========================================= */

function ensureDebtState() {
    if (!game?.players) return;

    game.players.forEach(player => {

        if (
            player.cash !== undefined &&
            Array.isArray(player.debts)
        ) {
            player.cash = Math.max(
                0,
                roundMoney(player.cash)
            );

            player.debts = player.debts
                .map(debt => ({
                    ...debt,
                    amount: Math.max(
                        0,
                        roundMoney(debt.amount)
                    )
                }))
                .filter(debt => debt.amount > 0);

            refreshPlayerBalance(player);
            return;
        }

        const oldBalance = roundMoney(player.balance);

        if (oldBalance >= 0) {
            player.cash = oldBalance;
            player.debts = [];
        } else {
            player.cash = 0;

            player.debts = [{
                type: "legacy",
                label: "Previous balance",
                amount: Math.abs(oldBalance)
            }];
        }

        refreshPlayerBalance(player);
    });

    if (game.finished === undefined) {
        game.finished = false;
    }

    if (game.finishedBy === undefined) {
        game.finishedBy = null;
    }

    if (game.finishedPot === undefined) {
        game.finishedPot = 0;
    }

    if (!game.rules) {
        game.rules = clone(DEFAULT_RULES);
    }

    if (game.rules.bonusAmount === undefined) {
        game.rules.bonusAmount = 2;
    }

    if (game.rules.bonusReason === undefined) {
        game.rules.bonusReason = "Quadra";
    }


    if (game.rules.drawPayment === undefined) {
        game.rules.drawPayment = 2;
    }

    if (game.rules.tongitsPayment === undefined) {
        game.rules.tongitsPayment = 4;
    }

    if (game.rules.roundPot === undefined) {
        game.rules.roundPot = 2;
    }

    if (game.rules.potWinStreak === undefined) {
        game.rules.potWinStreak = 3;
    }

    if (!Array.isArray(game.history)) {
        game.history = [];
    }

    if (!Array.isArray(game.undoStack)) {
        game.undoStack = [];
    }

    saveGame();
}


/* =========================================
   DEBT HELPERS
========================================= */

function addDebt(debtorIndex, debt) {
    const player = game.players[debtorIndex];

    if (!player.debts) {
        player.debts = [];
    }

    let amount = roundMoney(debt.amount);

    if (amount <= 0) return;

    let existing = null;

    if (debt.type === "player") {
        const creditorIndex = debt.playerIndex;
        const creditor = game.players[creditorIndex];

        // Net opposite player-to-player debts immediately.
        if (creditor && Array.isArray(creditor.debts)) {
            const reverseDebt = creditor.debts.find(
                item =>
                    item.type === "player" &&
                    item.playerIndex === debtorIndex
            );

            if (reverseDebt) {
                const offset = roundMoney(Math.min(amount, reverseDebt.amount));
                amount = roundMoney(amount - offset);
                reverseDebt.amount = roundMoney(reverseDebt.amount - offset);
                cleanupDebts(creditor);
                refreshPlayerBalance(creditor);

                if (amount <= 0) {
                    refreshPlayerBalance(player);
                    return;
                }
            }
        }

        existing = player.debts.find(
            item =>
                item.type === "player" &&
                item.playerIndex === creditorIndex
        );
    }

    else if (debt.type === "pot") {
        existing = player.debts.find(
            item => item.type === "pot"
        );
    }

    else if (debt.type === "legacy") {
        existing = player.debts.find(
            item =>
                item.type === "legacy" &&
                item.label === debt.label
        );
    }

    if (existing) {
        existing.amount = roundMoney(
            existing.amount + amount
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
    player.debts = (player.debts || [])
        .filter(debt => roundMoney(debt.amount) > 0);
}


/* =========================================
   SETTLE DEBTS
========================================= */

function settlePlayerDebts(playerIndex, chain = new Set()) {
    const player = game.players[playerIndex];

    if (!player) return;

    if (chain.has(playerIndex)) {
        refreshPlayerBalance(player);
        return;
    }

    const nextChain = new Set(chain);
    nextChain.add(playerIndex);

    cleanupDebts(player);

    for (let i = 0; i < player.debts.length; i++) {
        const debt = player.debts[i];

        if (player.cash <= 0) break;

        const payment = roundMoney(
            Math.min(player.cash, debt.amount)
        );

        if (payment <= 0) continue;

        player.cash = roundMoney(
            player.cash - payment
        );

        debt.amount = roundMoney(
            debt.amount - payment
        );

        if (debt.type === "pot") {
            game.pot = roundMoney(
                game.pot + payment
            );
        }

        else if (debt.type === "player") {
            const creditor =
                game.players[debt.playerIndex];

            if (creditor) {
                creditor.cash = roundMoney(
                    creditor.cash + payment
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
   PAY PLAYER
========================================= */

function payPlayer(
    fromIndex,
    toIndex,
    amount,
    reason
) {
    const from = game.players[fromIndex];
    const to = game.players[toIndex];

    const required = Math.max(
        0,
        roundMoney(amount)
    );

    const paid = roundMoney(
        Math.min(from.cash, required)
    );

    const unpaid = roundMoney(
        required - paid
    );

    if (paid > 0) {
        from.cash = roundMoney(
            from.cash - paid
        );

        to.cash = roundMoney(
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

function contributeToPot(playerIndex, amount) {
    const player = game.players[playerIndex];

    const required = Math.max(
        0,
        roundMoney(amount)
    );

    const paid = roundMoney(
        Math.min(player.cash, required)
    );

    const pending = roundMoney(
        required - paid
    );

    if (paid > 0) {
        player.cash = roundMoney(
            player.cash - paid
        );

        game.pot = roundMoney(
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

function getPendingPotTotal() {
    if (!game?.players) return 0;

    let total = 0;

    game.players.forEach(player => {
        (player.debts || []).forEach(debt => {
            if (debt.type === "pot") {
                total += num(debt.amount);
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
    const initial = Math.max(
        0,
        roundMoney(initialPot)
    );

    game = {
        currency: currency || "S$",

        initialPot: initial,

        pot: 0,
        round: 1,

        finished: false,
        finishedBy: null,
        finishedPot: 0,

        players: setupPlayers.map(
            (player, index) => {

                const startingBalance =
                    Math.max(
                        0,
                        roundMoney(player.money)
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

                    cash: startingBalance,

                    debts: [],

                    balance: startingBalance,

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
   NORMAL ROUND
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

            if (index === selectedWinner) {
                return;
            }

            payments.push({
                from: index,
                to: selectedWinner,
                amount: paymentAmount,
                baseAmount: paymentAmount,
                bonusAmount: 0,
                reason: type
            });
        }
    );

    pendingRound = {
        type,
        winner: selectedWinner,
        bonusEnabled: false,
        payments
    };
}


/* =========================================
   BONUS
========================================= */

function setPendingRoundBonus(reason, amount) {
    if (!pendingRound) return;

    const bonus = Math.max(0, roundMoney(amount));
    pendingRound.bonusEnabled = bonus > 0;
    pendingRound.bonusReason = String(reason || game.rules.bonusReason || "Bonus").trim() || "Bonus";
    pendingRound.bonusAmount = bonus;

    pendingRound.payments.forEach(payment => {
        const base =
            payment.baseAmount !== undefined
                ? payment.baseAmount
                : payment.amount;

        payment.baseAmount =
            roundMoney(base);

        payment.bonusAmount =
            roundMoney(bonus);

        payment.amount =
            roundMoney(
                payment.baseAmount +
                payment.bonusAmount
            );
    });
}


/* =========================================
   BEGIN ROUND SETTLEMENT
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

                    baseAmount:
                        payment.baseAmount ??
                        payment.amount,

                    bonusAmount:
                        payment.bonusAmount || 0,

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

    if (game.lastWinner === winner) {
        game.players[winner].streak += 1;
    } else {
        game.players.forEach(
            player => player.streak = 0
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
   QUICK PAY
========================================= */

function processQuickPay(
    receiverIndex,
    payerIndexes,
    amount,
    reason
) {
    if (
        !game ||
        game.finished
    ) {
        return null;
    }

    const receiver =
        game.players[receiverIndex];

    if (!receiver) {
        return null;
    }

    const paymentAmount =
        Math.max(
            0,
            roundMoney(amount)
        );

    if (
        paymentAmount <= 0 ||
        !Array.isArray(payerIndexes) ||
        payerIndexes.length === 0
    ) {
        return null;
    }

    const beforeState =
        createRoundSnapshot();

    const payments = [];

    payerIndexes.forEach(payerIndex => {

        if (payerIndex === receiverIndex) {
            return;
        }

        if (!game.players[payerIndex]) {
            return;
        }

        const result =
            payPlayer(
                payerIndex,
                receiverIndex,
                paymentAmount,
                reason || "Quick Pay"
            );

        payments.push({
            from:
                game.players[
                    payerIndex
                ].name,

            fromIndex:
                payerIndex,

            amount:
                result.amount,

            paid:
                result.paid,

            pending:
                result.pending
        });
    });

    if (payments.length === 0) {
        return null;
    }

    const historyEntry = {
        eventType: "quickPay",

        round: game.round,

        type: "Quick Pay",

        reason:
            String(
                reason || "Quick Pay"
            ),

        winner:
            receiver.name,

        receiverIndex,

        winnerAvatar:
            clone(receiver.avatar),

        amountPerPlayer:
            paymentAmount,

        payments,

        gameFinished: false
    };

    game.history.push(historyEntry);

    game.undoStack.push(beforeState);

    refreshAllBalances();
    saveGame();

    return {
        receiverIndex,
        receiverName: receiver.name,
        amountPerPlayer: paymentAmount,
        reason:
            String(
                reason || "Quick Pay"
            ),
        payments
    };
}


/* =========================================
   PENDING POT -> WINNER
========================================= */

function captureSettlementState() {
    return game.players.map((player, index) => ({
        index,
        name: player.name,
        cash: roundMoney(player.cash),
        balance: roundMoney(player.balance),
        debts: clone(player.debts || [])
    }));
}

function buildSettlementDetails(before, after, winnerIndex, potCashAwarded) {
    const details = [{
        type: "pot-award",
        text: `${game.players[winnerIndex].name} received ${money(potCashAwarded)} from the collected pot.`
    }];

    before.forEach((beforePlayer, index) => {
        const afterPlayer = after[index];
        (beforePlayer.debts || []).forEach(debt => {
            if (debt.type !== "player") return;
            const afterDebt = (afterPlayer.debts || []).find(
                item => item.type === "player" && item.playerIndex === debt.playerIndex
            );
            const remaining = afterDebt ? roundMoney(afterDebt.amount) : 0;
            const settled = roundMoney(debt.amount - remaining);
            if (settled > 0) {
                details.push({
                    type: "debt-settled",
                    text: `${beforePlayer.name} settled ${money(settled)} owed to ${game.players[debt.playerIndex].name}.`
                });
            }
        });
    });

    after.forEach(afterPlayer => {
        (afterPlayer.debts || []).forEach(debt => {
            if (debt.type !== "player") return;
            details.push({
                type: "remaining-debt",
                text: `${afterPlayer.name} still owes ${game.players[debt.playerIndex].name} ${money(debt.amount)}.`
            });
        });
    });
    return details;
}


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

            if (index === winnerIndex) {
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

function finishRound(takeExistingPot) {
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
       POT TAKEN = GAME FINISHED
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

        const settlementBefore = captureSettlementState();
        const collectedPotAwarded = roundMoney(game.pot);

        transferPendingPotToWinner(
            winnerIndex
        );

        winner.cash =
            roundMoney(
                winner.cash +
                game.pot
            );

        game.pot = 0;

        settlePlayerDebts(
            winnerIndex
        );

        const settlementAfter = captureSettlementState();
        const settlementDetails = buildSettlementDetails(
            settlementBefore,
            settlementAfter,
            winnerIndex,
            collectedPotAwarded
        );

        game.players.forEach(
            player => player.streak = 0
        );

        game.lastWinner = null;

        game.finished = true;
        game.finishedBy = winnerIndex;
        game.finishedPot = potWon;

        const historyEntry = {
            eventType: "round",

            round: game.round,

            type:
                pendingRound.type,

            winner:
                winner.name,

            winnerAvatar:
                clone(winner.avatar),

            bonusEnabled: Boolean(pendingRound.bonusEnabled),

            bonusReason: pendingRound.bonusReason || game.rules.bonusReason || "Bonus",

            bonusAmount: pendingRound.bonusEnabled ? pendingRound.bonusAmount : 0,

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

            settlementDetails:
                clone(settlementDetails),

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

            settlementDetails:
                clone(settlementDetails),

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
       NORMAL CONTINUE / POT KEPT
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
        eventType: "round",

        round:
            game.round,

        type:
            pendingRound.type,

        winner:
            winner.name,

        winnerAvatar:
            clone(winner.avatar),

        bonusEnabled: Boolean(pendingRound.bonusEnabled),

        bonusReason: pendingRound.bonusReason || game.rules.bonusReason || "Bonus",

        bonusAmount: pendingRound.bonusEnabled ? pendingRound.bonusAmount : 0,

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

    // Keep the audit trail. Undo reverses the game state, but the
    // original history record remains visible and is marked UNDONE.
    const auditHistory = Array.isArray(game.history)
        ? game.history
        : [];

    for (let i = auditHistory.length - 1; i >= 0; i--) {
        if (!auditHistory[i].undone) {
            auditHistory[i].undone = true;
            auditHistory[i].undoneAt = Date.now();
            break;
        }
    }

    game.history = auditHistory;

    game.lastWinner =
        snapshot.lastWinner;

    game.finished =
        snapshot.finished || false;

    game.finishedBy =
        snapshot.finishedBy ?? null;

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

    game.rules.bonusAmount =
        Math.max(
            0,
            roundMoney(
                settings.bonusAmount
            )
        );

    game.rules.bonusReason = String(settings.bonusReason || "Bonus").trim() || "Bonus";

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
   RESTART KEEP MONEY
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
   RESTART RESET MONEY
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