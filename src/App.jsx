import { useState } from "react";

const shuffle = (arr) => {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
};

const createDeck = () => {
  const deck = [];

  for (let i = 1; i <= 12; i++) {
    deck.push(i);
  }

  return shuffle(deck);
};

export default function BrainrotCardDuel() {
  const [playerDeck, setPlayerDeck] = useState(() => createDeck());
  const [aiDeck, setAiDeck] = useState(() => createDeck());
  const [playerWins, setPlayerWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [round, setRound] = useState(1);
  const [message, setMessage] = useState("Choose a card. First to 3 wins!");
  const [history, setHistory] = useState([]);
  const [lastBattle, setLastBattle] = useState(null);

  // AI memory / learning
  const [aiMemory, setAiMemory] = useState({
    playerPatterns: {},
    aggressiveScore: 0,
    roundsObserved: 0,
  });

  const gameOver = playerWins >= 3 || aiWins >= 3;

  const resetGame = () => {
    setPlayerDeck(createDeck());
    setAiDeck(createDeck());
    setPlayerWins(0);
    setAiWins(0);
    setRound(1);
    setMessage("Choose a card. First to 3 wins!");
    setHistory([]);
    setLastBattle(null);

    // AI keeps learning between matches
    setAiMemory((prev) => ({
      ...prev,
      roundsObserved: prev.roundsObserved,
    }));
  };

  // --- AI LEARNING SYSTEM ---
  const updateAiMemory = (playerCard) => {
    setAiMemory((prev) => {
      const updatedPatterns = { ...prev.playerPatterns };
      updatedPatterns[playerCard] = (updatedPatterns[playerCard] || 0) + 1;

      const aggressiveBoost = playerCard >= 8 ? 1 : -0.2;

      return {
        playerPatterns: updatedPatterns,
        aggressiveScore: prev.aggressiveScore + aggressiveBoost,
        roundsObserved: prev.roundsObserved + 1,
      };
    });
  };

  // AI predicts likely player behavior
  // This function only runs when the player clicks a card, not during render.
  const chooseAiCard = () => {
    const available = [...aiDeck];

    if (available.length === 1) {
      return available[0];
    }

    const aggressionLevel =
      aiMemory.roundsObserved > 0
        ? aiMemory.aggressiveScore / aiMemory.roundsObserved
        : 0;

    const smartness = Math.min(aiMemory.roundsObserved / 10, 1);

    let targetRange;

    if (aggressionLevel > 0.4) {
      targetRange = "high";
    } else if (aggressionLevel < -0.2) {
      targetRange = "low";
    } else {
      targetRange = "mid";
    }

    let preferredCards = [];

    if (targetRange === "high") {
      preferredCards = available.filter((card) => card >= 8);
    } else if (targetRange === "low") {
      preferredCards = available.filter((card) => card <= 5);
    } else {
      preferredCards = available.filter((card) => card >= 5 && card <= 9);
    }

    // Early game = more random. Later game = smarter.
    if (Math.random() > smartness || preferredCards.length === 0) {
      return available[Math.floor(Math.random() * available.length)];
    }

    preferredCards.sort((a, b) => a - b);
    return preferredCards[0];
  };

  const playCard = (playerCard) => {
    if (gameOver) return;

    const aiCard = chooseAiCard();

    setPlayerDeck((prev) => prev.filter((card) => card !== playerCard));
    setAiDeck((prev) => prev.filter((card) => card !== aiCard));

    updateAiMemory(playerCard);

    let roundResult = "Draw";
    let nextPlayerWins = playerWins;
    let nextAiWins = aiWins;

    if (playerCard > aiCard) {
      roundResult = "You Win";
      nextPlayerWins += 1;
      setPlayerWins(nextPlayerWins);
    } else if (aiCard > playerCard) {
      roundResult = "AI Wins";
      nextAiWins += 1;
      setAiWins(nextAiWins);
    }

    setLastBattle({ playerCard, aiCard, roundResult });

    setHistory((prev) => [
      {
        round,
        playerCard,
        aiCard,
        result: roundResult,
      },
      ...prev,
    ]);

    setRound((prev) => prev + 1);

    if (nextPlayerWins >= 3) {
      setMessage("🏆 You beat the Brainrot AI!");
      return;
    }

    if (nextAiWins >= 3) {
      setMessage("🤖 Brainrot AI adapted and defeated you.");
      return;
    }

    if (roundResult === "You Win") {
      setMessage(`🔥 Your ${playerCard} crushed the AI's hidden card!`);
    } else if (roundResult === "AI Wins") {
      setMessage(`💀 Brainrot AI outplayed you with ${aiCard}!`);
    } else {
      setMessage("⚖️ Equal power clash. Draw round.");
    }
  };

  const getAiMood = () => {
    const aggressionLevel =
      aiMemory.roundsObserved > 0
        ? aiMemory.aggressiveScore / aiMemory.roundsObserved
        : 0;

    if (aggressionLevel > 0.5) {
      return "AI thinks you play aggressively 😈";
    }

    if (aggressionLevel < -0.1) {
      return "AI thinks you save strong cards 🧠";
    }

    return "AI is still learning your brainrot strategy 🤖";
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black tracking-tight mb-2">
            🧠 BRAINROT CARD DUEL
          </h1>
          <p className="text-zinc-400 text-lg">
            Hidden-number battle • First to 3 round wins
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div className="bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-800">
            <h2 className="text-xl font-bold mb-4">👤 Player</h2>
            <div className="text-5xl font-black mb-2">{playerWins}</div>
            <div className="text-zinc-400">Round Wins</div>
          </div>

          <div className="bg-gradient-to-br from-fuchsia-900 to-purple-950 rounded-3xl p-6 shadow-2xl border border-fuchsia-700 text-center">
            <div className="text-sm uppercase tracking-widest text-fuchsia-300 mb-2">
              Round
            </div>
            <div className="text-6xl font-black">{round}</div>
            <div className="mt-4 text-fuchsia-200 text-sm">{getAiMood()}</div>
          </div>

          <div className="bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-800">
            <h2 className="text-xl font-bold mb-4">🤖 Brainrot AI</h2>
            <div className="text-5xl font-black mb-2">{aiWins}</div>
            <div className="text-zinc-400">Round Wins</div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-6 mb-6 border border-zinc-800 shadow-xl">
          <div className="text-xl font-bold mb-3">Battle Feed</div>
          <div className="text-lg text-zinc-200">{message}</div>

          {lastBattle && (
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-2xl p-4 text-center">
                <div className="text-zinc-400 mb-2">Your Card</div>
                <div className="text-5xl font-black">{lastBattle.playerCard}</div>
              </div>

              <div className="bg-zinc-800 rounded-2xl p-4 text-center">
                <div className="text-zinc-400 mb-2">AI Card</div>
                <div className="text-5xl font-black">{lastBattle.aiCard}</div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 shadow-xl mb-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-2xl font-bold">🎴 Your Hand</h2>
              <p className="text-zinc-400">
                Pick carefully. AI cannot see your choice beforehand.
              </p>
            </div>

            <button
              onClick={resetGame}
              className="bg-fuchsia-600 hover:bg-fuchsia-500 transition px-5 py-3 rounded-2xl font-bold"
            >
              Reset Match
            </button>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {playerDeck.map((card) => (
              <button
                key={card}
                onClick={() => playCard(card)}
                disabled={gameOver}
                className="aspect-square rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-700 border border-zinc-600 hover:scale-105 hover:border-fuchsia-500 transition-all duration-200 flex items-center justify-center text-4xl font-black disabled:opacity-40"
              >
                {card}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">🧠 AI Learning Stats</h2>

            <div className="space-y-4">
              <div>
                <div className="text-zinc-400 text-sm">Rounds Observed</div>
                <div className="text-3xl font-black">
                  {aiMemory.roundsObserved}
                </div>
              </div>

              <div>
                <div className="text-zinc-400 text-sm">Detected Strategy</div>
                <div className="text-xl font-bold mt-1">{getAiMood()}</div>
              </div>

              <div>
                <div className="text-zinc-400 text-sm mb-2">
                  Most Played Numbers
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(aiMemory.playerPatterns)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([card, count]) => (
                      <div
                        key={card}
                        className="bg-zinc-800 px-3 py-2 rounded-xl border border-zinc-700"
                      >
                        #{card} → {count}x
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-3xl p-6 border border-zinc-800 shadow-xl">
            <h2 className="text-2xl font-bold mb-4">📜 Match History</h2>

            <div className="space-y-3 max-h-[420px] overflow-auto pr-2">
              {history.length === 0 && (
                <div className="text-zinc-500">No rounds played yet.</div>
              )}

              {history.map((entry, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-800 rounded-2xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold">Round {entry.round}</div>
                    <div className="text-zinc-400 text-sm">
                      You: {entry.playerCard} vs AI: {entry.aiCard}
                    </div>
                  </div>

                  <div
                    className={`font-black text-lg ${
                      entry.result === "You Win"
                        ? "text-green-400"
                        : entry.result === "AI Wins"
                        ? "text-red-400"
                        : "text-yellow-300"
                    }`}
                  >
                    {entry.result}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-zinc-500 text-sm">
          The AI studies your habits and becomes smarter over time.
        </div>
      </div>
    </div>
  );
}
