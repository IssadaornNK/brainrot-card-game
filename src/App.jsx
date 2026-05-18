import { useState, useEffect, useRef } from "react";
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
  const [isThinking, setIsThinking] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [aiCardFlipped, setAiCardFlipped] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
const timerRef = useRef(null);

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
    setGameStarted(false);

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
 const chooseAiCard = async () => {
  const available = [...aiDeck];
  if (available.length === 1) return available[0];

  try {
    const prompt = `You are playing a card game. You have these cards: ${available.join(", ")}. 
The player has played these cards before: ${Object.entries(aiMemory.playerPatterns).map(([k,v]) => `${k} (${v}x)`).join(", ") || "none yet"}.
Player aggression score: ${aiMemory.aggressiveScore.toFixed(2)}.
Pick ONE card number from your available cards to maximize your chance of winning. 
Reply with ONLY a single number, nothing else.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await res.json();
    const text = data.candidates[0].content.parts[0].text.trim();
    const picked = parseInt(text);

    if (available.includes(picked)) return picked;
  } catch (e) {
    console.error("Gemini error:", e);
  }

  // fallback
  return available[Math.floor(Math.random() * available.length)];
};

  const playCard = async (playerCard) => {
  if (gameOver || isThinking || !gameStarted) return;
  clearInterval(timerRef.current);
  setIsThinking(true);

    const aiCard = await chooseAiCard();

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
    setIsThinking(false);
    setAiCardFlipped(false);
setTimeout(() => setAiCardFlipped(true), 300);

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

useEffect(() => {
  if (gameOver || isThinking || !gameStarted) {
    clearInterval(timerRef.current);
    return;
  }

  setTimeLeft(15);
  clearInterval(timerRef.current);

  timerRef.current = setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        clearInterval(timerRef.current);
        const playerCard = playerDeck[Math.floor(Math.random() * playerDeck.length)];
        playCard(playerCard);
        return 15;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearInterval(timerRef.current);
}, [round, gameOver, isThinking, gameStarted]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans">
      <div className="max-w-6xl mx-auto">
        {!gameStarted && !gameOver && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-zinc-900 border border-fuchsia-700 rounded-3xl p-10 text-center max-w-md mx-4 shadow-2xl">
      <div className="text-7xl mb-4">🧠</div>
      <h2 className="text-4xl font-black text-fuchsia-400 mb-2">BRAINROT CARD DUEL</h2>
      <p className="text-zinc-400 mb-2">First to 3 round wins</p>
      <p className="text-zinc-500 text-sm mb-8">You have 15 seconds per round. AI learns your strategy.</p>
      <button
        onClick={() => setGameStarted(true)}
        className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 transition px-6 py-4 rounded-2xl font-black text-xl"
      >
        Play 🎴
      </button>
    </div>
  </div>
)}
        {gameOver && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-zinc-900 border border-fuchsia-700 rounded-3xl p-10 text-center max-w-md mx-4 shadow-2xl">
      {playerWins >= 3 ? (
        <>
          <div className="text-7xl mb-4">🏆</div>
          <h2 className="text-4xl font-black text-fuchsia-400 mb-2">YOU WIN!</h2>
          <p className="text-zinc-400 mb-6">You outsmarted the Brainrot AI!</p>
        </>
      ) : (
        <>
          <div className="text-7xl mb-4">🤖</div>
          <h2 className="text-4xl font-black text-red-400 mb-2">AI WINS!</h2>
          <p className="text-zinc-400 mb-6">Brainrot AI adapted and defeated you.</p>
        </>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-zinc-800 rounded-2xl p-4">
          <div className="text-zinc-400 text-sm">Your Wins</div>
          <div className="text-4xl font-black text-fuchsia-400">{playerWins}</div>
        </div>
        <div className="bg-zinc-800 rounded-2xl p-4">
          <div className="text-zinc-400 text-sm">AI Wins</div>
          <div className="text-4xl font-black text-red-400">{aiWins}</div>
        </div>
      </div>

      <button
        onClick={resetGame}
        className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 transition px-6 py-4 rounded-2xl font-black text-xl"
      >
        Play Again 🔄
      </button>
    </div>
  </div>
)}
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
  <h2 className="text-xl font-bold mb-4">🤖 Brainrot AI</h2>
  <div className="text-5xl font-black mb-2">{aiWins}</div>
  <div className="text-zinc-400">Round Wins</div>
  <div className="mt-4">
    <div className="text-zinc-400 text-xs mb-2">Cards Remaining</div>
    <div className="flex flex-wrap gap-1">
      {aiDeck.map((_, idx) => (
        <div
          key={idx}
          className="w-8 h-10 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600 flex items-center justify-center text-lg"
        >
          🂠
        </div>
      ))}
    </div>
  </div>
</div>

          <div className="bg-gradient-to-br from-fuchsia-900 to-purple-950 rounded-3xl p-6 shadow-2xl border border-fuchsia-700 text-center">
            <div className="text-sm uppercase tracking-widest text-fuchsia-300 mb-2">
              Round
            </div>
            <div className="text-6xl font-black">{round}</div>
            <div className="mt-4">
  {(() => {
    const aggression = aiMemory.roundsObserved > 0
      ? aiMemory.aggressiveScore / aiMemory.roundsObserved
      : 0;
    const smartness = Math.min(aiMemory.roundsObserved / 10, 1);
    const smartPct = Math.round(smartness * 100);
    const aggrPct = Math.round(((aggression + 1) / 2) * 100);

    return (
      <div className="space-y-2">
        <div className="text-fuchsia-200 text-xs mb-1">{getAiMood()}</div>

        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>🧠 AI Smartness</span>
            <span>{smartPct}%</span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${smartPct}%`,
                background: `linear-gradient(90deg, #a855f7, #ec4899)`,
              }}
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>😈 Aggression Read</span>
            <span>{aggrPct}%</span>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-700"
              style={{
                width: `${aggrPct}%`,
                background: `linear-gradient(90deg, #22d3ee, #f59e0b)`,
              }}
            />
          </div>
        </div>
      </div>
    );
  })()}
</div>
          </div>

          <div className="bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-800">
            <h2 className="text-xl font-bold mb-4">🤖 Brainrot AI</h2>
            <div className="text-5xl font-black mb-2">{aiWins}</div>
            <div className="text-zinc-400">Round Wins</div>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-3xl p-6 mb-6 border border-zinc-800 shadow-xl">
          <div className="text-xl font-bold mb-3">Battle Feed</div>
{isThinking ? (
  <div className="flex items-center gap-3 text-fuchsia-400 text-lg animate-pulse">
    <span>🤖 Brainrot AI is thinking...</span>
  </div>
) : (
  <div className="text-lg text-zinc-200">{message}</div>
)}

          {lastBattle && (
  <div className="mt-5 grid grid-cols-2 gap-4">
    <div className="bg-zinc-800 rounded-2xl p-4 text-center">
      <div className="text-zinc-400 mb-2">Your Card</div>
      <div className="relative inline-block">
        <img
          src={`/src/assets/${lastBattle.playerCard}.png`}
          alt={`Card ${lastBattle.playerCard}`}
          className="w-24 h-24 object-contain mx-auto"
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm font-black px-2 py-0.5 rounded-lg border border-fuchsia-500">
          {lastBattle.playerCard}
        </div>
      </div>
    </div>

    <div className="bg-zinc-800 rounded-2xl p-4 text-center">
  <div className="text-zinc-400 mb-2">AI Card</div>
  <div className="card-flip w-24 h-24 mx-auto relative">
    <div className={`card-flip-inner w-full h-full ${aiCardFlipped ? "flipped" : ""}`}>
      <div className="card-front w-full h-full bg-zinc-700 border border-zinc-600 rounded-2xl flex items-center justify-center text-4xl">
        🂠
      </div>
      <div className="card-back w-full h-full rounded-2xl overflow-hidden">
        <img
          src={`/src/assets/${lastBattle.aiCard}.png`}
          alt={`Card ${lastBattle.aiCard}`}
          className="w-full h-full object-contain"
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs font-black px-2 py-0.5 rounded-lg border border-red-500">
          {lastBattle.aiCard}
        </div>
      </div>
    </div>
  </div>
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
<div className="mt-2 flex items-center gap-2">
  <span className={`text-2xl font-black ${timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-fuchsia-400"}`}>
    ⏱️ {timeLeft}s
  </span>
  <div className="flex-1 bg-zinc-700 rounded-full h-2">
    <div
      className="h-2 rounded-full transition-all duration-1000"
      style={{
        width: `${(timeLeft / 15) * 100}%`,
        background: timeLeft <= 5 ? "#f87171" : "linear-gradient(90deg, #a855f7, #ec4899)",
      }}
    />
  </div>
</div>
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
  disabled={gameOver || isThinking}
  className="aspect-square rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-700 border border-zinc-600 hover:scale-105 hover:border-fuchsia-500 transition-all duration-200 flex flex-col items-center justify-center disabled:opacity-40 overflow-hidden relative"
>
  <img
    src={`/src/assets/${card}.png`}
    alt={`Card ${card}`}
    className="w-4/5 h-4/5 object-contain"
  />
  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm font-black px-2 py-0.5 rounded-lg border border-fuchsia-500 drop-shadow">
  {card}
</div>
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
<div className="mt-2 space-y-3">
  <div>
    <div className="flex justify-between text-xs text-zinc-400 mb-1">
      <span>🧠 AI Smartness</span>
      <span>{Math.round(Math.min(aiMemory.roundsObserved / 10, 1) * 100)}%</span>
    </div>
    <div className="w-full bg-zinc-700 rounded-full h-3">
      <div
        className="h-3 rounded-full transition-all duration-700"
        style={{
          width: `${Math.round(Math.min(aiMemory.roundsObserved / 10, 1) * 100)}%`,
          background: "linear-gradient(90deg, #a855f7, #ec4899)",
        }}
      />
    </div>
  </div>

  <div>
    <div className="flex justify-between text-xs text-zinc-400 mb-1">
      <span>😈 Aggression Read</span>
      <span>{Math.round(((aiMemory.roundsObserved > 0 ? aiMemory.aggressiveScore / aiMemory.roundsObserved : 0) + 1) / 2 * 100)}%</span>
    </div>
    <div className="w-full bg-zinc-700 rounded-full h-3">
      <div
        className="h-3 rounded-full transition-all duration-700"
        style={{
          width: `${Math.round(((aiMemory.roundsObserved > 0 ? aiMemory.aggressiveScore / aiMemory.roundsObserved : 0) + 1) / 2 * 100)}%`,
          background: "linear-gradient(90deg, #22d3ee, #f59e0b)",
        }}
      />
    </div>
  </div>

  <div>
    <div className="flex justify-between text-xs text-zinc-400 mb-1">
      <span>🎯 Rounds Analyzed</span>
      <span>{aiMemory.roundsObserved} / 10</span>
    </div>
    <div className="w-full bg-zinc-700 rounded-full h-3">
      <div
        className="h-3 rounded-full transition-all duration-700"
        style={{
          width: `${Math.min(aiMemory.roundsObserved / 10 * 100, 100)}%`,
          background: "linear-gradient(90deg, #4ade80, #22d3ee)",
        }}
      />
    </div>
  </div>
</div>
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
