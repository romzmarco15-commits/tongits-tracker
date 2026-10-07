/* =========================================
   TONGITS VISUAL ANIMATIONS

   IMPORTANT:
   These animations never change game data.
   game.js remains the source of truth.
========================================= */


function wait(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}


function elementCenter(element) {
    if (!element) {
        return {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2
        };
    }

    const rect =
        element.getBoundingClientRect();

    return {
        x:
            rect.left +
            rect.width / 2,

        y:
            rect.top +
            rect.height / 2
    };
}


function playerCard(index) {
    return document.querySelector(
        `[data-player-card="${index}"]`
    );
}


function potElement() {
    return document.getElementById(
        "potArea"
    );
}


function createFlyingMoney(
    text,
    start,
    end,
    extraClass = ""
) {
    const layer =
        document.getElementById(
            "animationLayer"
        );

    if (!layer) {
        return;
    }


    const item =
        document.createElement(
            "div"
        );

    item.className =
        `flying-money ${extraClass}`;

    item.textContent =
        text;


    item.style.left =
        `${start.x}px`;

    item.style.top =
        `${start.y}px`;


    layer.appendChild(
        item
    );


    requestAnimationFrame(
        () => {

            requestAnimationFrame(
                () => {

                    item.style.left =
                        `${end.x}px`;

                    item.style.top =
                        `${end.y}px`;

                    item.style.opacity =
                        "0.15";

                    item.style.transform =
                        "translate(-50%, -50%) scale(0.75)";
                }
            );
        }
    );


    setTimeout(
        () => item.remove(),
        700
    );
}


function pulsePot() {
    const pot =
        potElement();

    if (!pot) return;


    pot.classList.remove(
        "pot-pulse"
    );


    void pot.offsetWidth;


    pot.classList.add(
        "pot-pulse"
    );


    setTimeout(
        () =>
            pot.classList.remove(
                "pot-pulse"
            ),
        650
    );
}


function flashWinner(index) {
    const card =
        playerCard(index);

    if (!card) return;


    card.classList.remove(
        "winner-flash"
    );


    void card.offsetWidth;


    card.classList.add(
        "winner-flash"
    );


    setTimeout(
        () =>
            card.classList.remove(
                "winner-flash"
            ),
        800
    );
}


/*
    LOSERS -> WINNER
*/

async function animateWinnerPayments(
    payments,
    winnerIndex
) {
    if (
        !payments ||
        payments.length === 0
    ) {
        return;
    }


    const winner =
        playerCard(
            winnerIndex
        );

    const winnerPosition =
        elementCenter(
            winner
        );


    payments.forEach(
        (payment, order) => {

            const loser =
                playerCard(
                    payment.from
                );


            const start =
                elementCenter(
                    loser
                );


            setTimeout(
                () => {

                    createFlyingMoney(
                        `+${money(
                            payment.amount
                        )}`,
                        start,
                        winnerPosition
                    );
                },
                order * 90
            );
        }
    );


    await wait(
        600 +
        payments.length * 90
    );


    flashWinner(
        winnerIndex
    );
}


/*
    EVERY PLAYER -> POT
*/

async function animateRoundPotContribution() {
    if (!game) return;


    const potPosition =
        elementCenter(
            potElement()
        );


    game.players.forEach(
        (player, index) => {

            const card =
                playerCard(index);


            const start =
                elementCenter(
                    card
                );


            setTimeout(
                () => {

                    createFlyingMoney(
                        `+${money(
                            game.rules.roundPot
                        )}`,
                        start,
                        potPosition,
                        "to-pot"
                    );
                },
                index * 70
            );
        }
    );


    await wait(
        580 +
        game.players.length * 70
    );


    pulsePot();
}


/*
    POT -> WINNER
*/

async function animatePotToWinner(
    winnerIndex,
    amount
) {
    const potPosition =
        elementCenter(
            potElement()
        );


    const winnerPosition =
        elementCenter(
            playerCard(
                winnerIndex
            )
        );


    createFlyingMoney(
        `+${money(amount)}`,
        potPosition,
        winnerPosition,
        "big-pot"
    );


    await wait(650);


    flashWinner(
        winnerIndex
    );
}