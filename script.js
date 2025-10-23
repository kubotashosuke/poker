const suits = ['club', 'diamond', 'heart', 'spade'];
const values = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'];
const BET_AMOUNT = 200; // 固定のベット/レイズ額
const INITIAL_CHIP = 10000;
const CHIP_STORAGE_KEY = 'pokerGameChips'; // localStorageのキー

// ゲーム状態の基本テンプレート
const GAME_STATE_TEMPLATE = {
    round: -1, 
    roundName: '待機中',
    communityCards: [],
    hands: [
        { name: 'プレイヤー1', hand: [], elementId: 'player-cards-1', chipAmount: INITIAL_CHIP, status: 'Active', isCPU: false },
        { name: 'ディーラー', hand: [], elementId: 'dealer-cards', chipAmount: INITIAL_CHIP, status: 'Active', isCPU: true }
    ],
    potAmount: 0,
    showdown: false,
    message: 'ゲーム開始ボタンを押してください。'
};

let gameState = JSON.parse(JSON.stringify(GAME_STATE_TEMPLATE)); // 初期状態

let deck = [];

// === DOM要素 ===
const statusMessageEl = document.getElementById('status-message');
const communityCardsEl = document.getElementById('community-cards');
const playerControlsEl = document.getElementById('player-1-controls');
const nextRoundButtonEl = document.getElementById('next-round-button');
const potAmountEl = document.getElementById('pot-amount');
const dealerChipEl = document.getElementById('dealer-chips');
const player1ChipEl = document.getElementById('player-1-chips');
const betRaiseButtonEl = document.getElementById('bet-raise-button');

// === チップ保持 (localStorage) 関数 ===

function loadChips() {
    const chipData = localStorage.getItem(CHIP_STORAGE_KEY);
    if (chipData) {
        const parsedData = JSON.parse(chipData);
        gameState.hands.find(p => p.name === 'プレイヤー1').chipAmount = parsedData.player1;
        gameState.hands.find(p => p.name === 'ディーラー').chipAmount = parsedData.dealer;
    }
}

function saveChips() {
    const chipData = {
        player1: gameState.hands.find(p => p.name === 'プレイヤー1').chipAmount,
        dealer: gameState.hands.find(p => p.name === 'ディーラー').chipAmount
    };
    localStorage.setItem(CHIP_STORAGE_KEY, JSON.stringify(chipData));
}


// === ユーティリティ関数 ===

function createDeck() {
    deck = [];
    for (const suit of suits) {
        for (const value of values) {
            deck.push({ suit, value });
        }
    }
    shuffleDeck();
}

function shuffleDeck() {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function renderCard(card, isHidden = false) {
    const cardEl = document.createElement('div');
    cardEl.classList.add('card');
    
    // フォルダ構造 (poker/からの参照) に合わせてパスを修正
    const imagePath = isHidden
        ? 'トランプ/card_back.png' 
        : `トランプ/card_${card.suit}_${card.value}.png`;
        
    cardEl.style.backgroundImage = `url(${imagePath})`;
    return cardEl;
}

// === 表示更新関数 ===

function updateDisplay() {
    statusMessageEl.textContent = `ラウンド: ${gameState.roundName}`;
    document.getElementById('game-message').textContent = gameState.message;
    potAmountEl.textContent = gameState.potAmount.toLocaleString();
    
    const dealer = gameState.hands.find(p => p.name === 'ディーラー');
    const player1 = gameState.hands.find(p => p.name === 'プレイヤー1');

    dealerChipEl.textContent = dealer.chipAmount.toLocaleString();
    player1ChipEl.textContent = player1.chipAmount.toLocaleString();

    // コミュニティカード
    communityCardsEl.innerHTML = '';
    gameState.communityCards.forEach(card => {
        communityCardsEl.appendChild(renderCard(card));
    });

    // 各プレイヤーの手札
    gameState.hands.forEach(player => {
        const targetEl = document.getElementById(player.elementId);
        // リアクション要素は削除されたため、ここでの処理は不要
        
        if (!targetEl) return;
        targetEl.innerHTML = '';
        
        // フォールドしている場合はカードを表示しない
        if (player.status === 'Fold') {
             targetEl.innerHTML = `<span style="color: #e57373; font-weight: bold; font-size: 1.2em;">FOLDED</span>`;
        } else {
            player.hand.forEach((card, index) => {
                let isHidden = false;
                
                // ディーラーの手札はショーダウン以外は非表示
                if (player.isCPU && !gameState.showdown) {
                    isHidden = true;
                }
                // プレイヤーの手札は常に公開
                else if (!player.isCPU) {
                    isHidden = false;
                }

                const cardEl = renderCard(card, isHidden);
                targetEl.appendChild(cardEl);
            });
        }
        
        // リアクション表示処理は削除
    });

    // ベット/レイズボタンのテキスト更新
    betRaiseButtonEl.textContent = `ベット/レイズ (${BET_AMOUNT})`;
    
    // プレイヤーがチップ不足の場合、ボタンを無効化
    if (player1.chipAmount < BET_AMOUNT) {
        betRaiseButtonEl.disabled = true;
        betRaiseButtonEl.textContent = `ベット/レイズ (チップ不足)`;
    } else {
        betRaiseButtonEl.disabled = false;
    }
}

// === ハンド判定ロジック (簡略版) ===

// カードの強さを数値に変換 (A=14, K=13, ..., 2=2)
function getCardRankValue(cardValue) {
    if (cardValue === '01') return 14; // Ace
    if (cardValue === '13') return 13; // King
    if (cardValue === '12') return 12; // Queen
    if (cardValue === '11') return 11; // Jack
    return parseInt(cardValue);
}

// 役の判定 (テキサス・ホールデムのルールに基づく簡略ロジック)
// 戻り値: { rank: 役の強さ (1-9), name: 役名, kickers: キッカーの配列 }
function evaluateHand(playerHand, communityCards) {
    const combined = [...playerHand, ...communityCards];

    const ranks = combined.map(card => getCardRankValue(card.value)).sort((a, b) => b - a);
    const suits = combined.map(card => card.suit);

    const rankCounts = ranks.reduce((acc, rank) => {
        acc[rank] = (acc[rank] || 0) + 1;
        return acc;
    }, {});

    const maxCount = Math.max(...Object.values(rankCounts));
    const pairRanks = Object.keys(rankCounts).filter(r => rankCounts[r] === 2).map(Number).sort((a, b) => b - a);
    const setRanks = Object.keys(rankCounts).filter(r => rankCounts[r] === 3).map(Number).sort((a, b) => b - a);
    
    // フラッシュの判定
    const suitCounts = suits.reduce((acc, suit) => {
        acc[suit] = (acc[suit] || 0) + 1;
        return acc;
    }, {});
    const isFlush = Math.max(...Object.values(suitCounts)) >= 5;

    // ストレートの判定 (簡略)
    const uniqueRanks = Array.from(new Set(ranks)).sort((a, b) => b - a);
    let isStraight = false;
    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        if (uniqueRanks[i] === uniqueRanks[i+4] + 4) {
            isStraight = true;
            break;
        }
    }
    // A-5ストレート (A, 5, 4, 3, 2) の判定
    if (uniqueRanks.includes(14) && uniqueRanks.includes(5) && uniqueRanks.includes(4) && uniqueRanks.includes(3) && uniqueRanks.includes(2)) {
         isStraight = true;
    }

    // 役の強さ判定 (ロイヤル/ストレートフラッシュの厳密判定は省略)
    if (isStraight && isFlush) return { rank: 9, name: 'ストレートフラッシュ', kickers: ranks };
    if (maxCount >= 4) return { rank: 8, name: 'フォーカード', kickers: ranks };
    if (setRanks.length >= 1 && pairRanks.length >= 1) return { rank: 7, name: 'フルハウス', kickers: ranks };
    if (isFlush) return { rank: 6, name: 'フラッシュ', kickers: ranks };
    if (isStraight) return { rank: 5, name: 'ストレート', kickers: ranks };
    if (maxCount >= 3) return { rank: 4, name: 'スリーカード', kickers: ranks };
    if (pairRanks.length >= 2) return { rank: 3, name: 'ツーペア', kickers: ranks };
    if (maxCount >= 2) return { rank: 2, name: 'ワンペア', kickers: ranks };

    return { rank: 1, name: 'ハイカード', kickers: ranks };
}

// 勝者決定ロジック
function determineWinner(player1, player2, communityCards) {
    const hand1 = evaluateHand(player1.hand, communityCards);
    const hand2 = evaluateHand(player2.hand, communityCards);

    // 役の強さ比較 (9 > 8 > ... > 1)
    if (hand1.rank > hand2.rank) return { winner: player1, handName: hand1.name };
    if (hand2.rank > hand1.rank) return { winner: player2, handName: hand2.name };

    // 役のランクが同じ場合、キッカー（高位カード）で比較
    for (let i = 0; i < hand1.kickers.length; i++) {
        if (hand1.kickers[i] > hand2.kickers[i]) return { winner: player1, handName: hand1.name + " (Kicker Win)" };
        if (hand2.kickers[i] > hand1.kickers[i]) return { winner: player2, handName: hand2.name + " (Kicker Win)" };
    }

    // 引き分け
    return { winner: null, handName: hand1.name + " (Split Pot)" };
}


// === ゲーム進行ロジック ===

function initGame() {
    loadChips(); // チップのロード
    updateDisplay();
}

function startNewGame() {
    // チップ額のみ保持し、他はリセット
    const p1Chips = gameState.hands.find(p => p.name === 'プレイヤー1').chipAmount;
    const dealerChips = gameState.hands.find(p => p.name === 'ディーラー').chipAmount;

    gameState = JSON.parse(JSON.stringify(GAME_STATE_TEMPLATE));
    gameState.hands.find(p => p.name === 'プレイヤー1').chipAmount = p1Chips;
    gameState.hands.find(p => p.name === 'ディーラー').chipAmount = dealerChips;

    gameState.round = 0;
    gameState.roundName = 'プリフロップ';

    // 破産チェック
    if (p1Chips < 100 || dealerChips < 100) {
        gameState.message = `ゲームを続行するには、両者のチップが100以上必要です。`;
        document.getElementById('deal-button').style.display = 'block';
        playerControlsEl.style.display = 'none';
        updateDisplay();
        return;
    }
    
    createDeck();
    
    // 強制ブラインドベット（両者100ずつ）
    gameState.hands.forEach(p => {
        p.chipAmount -= 100;
        gameState.potAmount += 100;
    });

    // カード配布
    for (let i = 0; i < 2; i++) {
        gameState.hands.forEach(p => {
            if (deck.length > 0) {
                 p.hand.push(deck.pop());
            }
        });
    }

    gameState.message = `ゲーム開始！プリフロップ。アクションしてください。`;
    
    document.getElementById('deal-button').style.display = 'none';
    playerControlsEl.style.display = 'flex';
    
    updateDisplay();
}

// プレイヤーのアクション処理
function handlePlayerAction(action) {
    const player = gameState.hands.find(p => p.name === 'プレイヤー1');
    
    if (player.status === 'Fold') return;

    if (action === 'FOLD') {
        player.status = 'Fold';
        gameState.message = 'あなたがフォールドしました。CPUの勝ちです。';
        endGame(gameState.hands.find(p => p.name === 'ディーラー'));
        return;
    } else if (action === 'BET_RAISE') {
        player.chipAmount -= BET_AMOUNT;
        gameState.potAmount += BET_AMOUNT;
    }
    
    playerControlsEl.style.display = 'none';
    gameState.message = `あなたが【${action}】しました。CPUがアクション中です...`;
    updateDisplay();
    
    setTimeout(() => {
        handleCPUAction(action);
    }, 1500);
}

// CPU (ディーラー) のアクション処理
function handleCPUAction(playerAction) {
    const cpu = gameState.hands.find(p => p.name === 'ディーラー');
    const player = gameState.hands.find(p => p.name === 'プレイヤー1');
    
    if (cpu.status === 'Fold') {
         // 既にフォールド済みなら次のラウンドへ (自動進行)
         goToNextRound();
         return;
    }
    
    if (playerAction === 'BET_RAISE') {
        if (Math.random() < 0.7 && cpu.chipAmount >= BET_AMOUNT) { 
            cpu.chipAmount -= BET_AMOUNT;
            gameState.potAmount += BET_AMOUNT;
            gameState.message = `CPUはコールしました。`;
        } else {
            cpu.status = 'Fold';
            gameState.message = `CPUがフォールドしました。あなたの勝ちです！`;
            endGame(player); 
            updateDisplay();
            return;
        }
    } else {
        // プレイヤーがチェック/コールの場合、CPUはチェック
        gameState.message = `CPUはチェックしました。`;
    }

    // CPUのアクション完了後、自動で次のラウンドへ
    goToNextRound();
}

function goToNextRound() {
    // 両者がフォールドしていないか確認
    const activePlayers = gameState.hands.filter(p => p.status === 'Active').length;
    if (activePlayers <= 1 && gameState.round < 3) {
        // フォールドで勝者が決まっている場合は何もしない (endGameで処理済み)
        return; 
    }

    if (gameState.round === 0) {
        goToFlop();
    } else if (gameState.round === 1) {
        goToTurn();
    } else if (gameState.round === 2) {
        goToRiver();
    } 
}

function goToFlop() {
    gameState.round = 1;
    gameState.roundName = 'フロップ';
    gameState.communityCards.push(deck.pop(), deck.pop(), deck.pop());
    gameState.message = 'フロップ：コミュニティカード3枚公開。アクションしてください。';
    playerControlsEl.style.display = 'flex';
    updateDisplay();
}

function goToTurn() {
    gameState.round = 2;
    gameState.roundName = 'ターン';
    gameState.communityCards.push(deck.pop());
    gameState.message = 'ターン：コミュニティカード4枚目公開。アクションしてください。';
    playerControlsEl.style.display = 'flex';
    updateDisplay();
}

function goToRiver() {
    gameState.round = 3;
    gameState.roundName = 'リバー';
    gameState.communityCards.push(deck.pop());
    gameState.message = 'リバー：コミュニティカード5枚目公開。ショーダウン！';
    gameState.showdown = true; 
    
    playerControlsEl.style.display = 'none';
    
    updateDisplay(); // ショーダウン表示

    setTimeout(() => {
        const p1 = gameState.hands.find(p => p.name === 'プレイヤー1');
        const cpu = gameState.hands.find(p => p.name === 'ディーラー');

        // 両者アクティブの場合のみ役判定、それ以外はフォールドで決まっている
        if (p1.status === 'Active' && cpu.status === 'Active') {
            const result = determineWinner(p1, cpu, gameState.communityCards);
            endGame(result.winner, result.handName);
        } else {
             endGame(p1.status === 'Active' ? p1 : cpu, "フォールド勝ち");
        }
    }, 2000); // 2秒後に判定結果を表示
}

function endGame(winner, handName) {
    gameState.showdown = true;
    
    if (winner) {
        winner.chipAmount += gameState.potAmount;
        gameState.message = `${winner.name}の勝利！【${handName}】でポット(${gameState.potAmount}チップ)を獲得しました！`;
        showWinnerMessage(winner.name, handName);
    } else if (handName.includes("Split Pot")) {
         // 引き分け
         gameState.hands.forEach(p => p.chipAmount += Math.floor(gameState.potAmount / 2));
         gameState.message = `引き分け！ポット(${gameState.potAmount}チップ)をスプリットしました。`;
         showWinnerMessage("引き分け", handName);
    }
    
    gameState.potAmount = 0;
    saveChips(); // チップを保存
    
    document.getElementById('deal-button').style.display = 'block';
    
    updateDisplay();
}

// === 大きな勝利メッセージ表示機能 ===
function showWinnerMessage(winnerName, handName) {
    // 既存のメッセージを削除
    let overlay = document.getElementById('winner-message-overlay');
    if (overlay) overlay.remove();

    overlay = document.createElement('div');
    overlay.id = 'winner-message-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.85);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: white;
        z-index: 1000;
        font-size: 5vw; /* 画面サイズに合わせて大きく */
        text-shadow: 0 0 10px #ffeb3b;
        animation: fadeIn 1s ease-in-out;
    `;
    
    const title = document.createElement('div');
    title.textContent = `${winnerName} の WIN!! 🎉`;
    title.style.cssText = 'color: #ffeb3b; margin-bottom: 20px; font-weight: bold; font-size: 1.5em;';

    const handDisplay = document.createElement('div');
    handDisplay.textContent = `成立役: 【${handName}】`;
    handDisplay.style.cssText = 'font-size: 0.5em; color: #00bcd4;';

    const prompt = document.createElement('div');
    prompt.textContent = `クリックして続ける`;
    prompt.style.cssText = 'font-size: 0.2em; margin-top: 40px; color: #bdbdbd; cursor: pointer;';

    overlay.appendChild(title);
    overlay.appendChild(handDisplay);
    overlay.appendChild(prompt);
    
    overlay.onclick = () => {
        overlay.remove();
    };

    document.body.appendChild(overlay);
}
