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
  for (let i = 1; i <= 12; i++) deck.push(i);
  return shuffle(deck);
};

// Special card definitions
const SPECIAL_CARDS = {
  1: { name: "Underdog", emoji: "⚡", desc: "Beats card 12!", color: "#ffcc00" },
  6: { name: "Steal", emoji: "🪝", desc: "If you lose, steal AI's card back", color: "#00ccff" },
  7: { name: "Mirror", emoji: "🪞", desc: "Always draws — no one loses", color: "#cc88ff" },
  11: { name: "Double", emoji: "💥", desc: "Win = +2 points instead of 1", color: "#ff6600" },
};

// Random events every 3 rounds
const RANDOM_EVENTS = [
  { id: "chaos", name: "CHAOS ROUND", emoji: "🌀", desc: "Lower card wins this round!", color: "#ff00ff" },
  { id: "blind", name: "BLIND ROUND", emoji: "👁", desc: "You can't see your card numbers!", color: "#ffaa00" },
  { id: "double", name: "DOUBLE OR NOTHING", emoji: "🎲", desc: "Win = +2 pts, Lose = -1 pt this round!", color: "#00ff88" },
];

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
  const [playerHand, setPlayerHand] = useState([]);
  const [difficulty, setDifficulty] = useState("medium");

  // Special & Event states
  const [currentEvent, setCurrentEvent] = useState(null);
  const [showEventBanner, setShowEventBanner] = useState(false);
  const [stolenCard, setStolenCard] = useState(null); // for card 6

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
    setPlayerHand([]);
    setCurrentEvent(null);
    setShowEventBanner(false);
    setStolenCard(null);
    setAiMemory((prev) => ({ ...prev, roundsObserved: prev.roundsObserved }));
  };

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

  const chooseAiCard = async () => {
    const available = [...aiDeck];
    if (available.length === 1) return available[0];

    if (difficulty === "easy") return Math.min(...available);

    if (difficulty === "medium" && Math.random() < 0.4) {
      return available[Math.floor(Math.random() * available.length)];
    }

    try {
      const playedCards = Object.entries(aiMemory.playerPatterns)
        .map(([k, v]) => `${k} (${v}x)`).join(", ") || "none yet";
      const remainingHighCards = available.filter(c => c >= 8).length;
      const remainingLowCards = available.filter(c => c <= 4).length;
      const aggrLevel = aiMemory.roundsObserved > 0
        ? aiMemory.aggressiveScore / aiMemory.roundsObserved : 0;

      let logicPick = available[Math.floor(Math.random() * available.length)];
      if (difficulty === "hard") {
        if (aggrLevel > 0.3) logicPick = Math.max(...available);
        else if (aggrLevel < -0.1) {
          const midCards = available.filter(c => c >= 5 && c <= 8);
          logicPick = midCards.length > 0 ? midCards[Math.floor(Math.random() * midCards.length)] : available[Math.floor(Math.random() * available.length)];
        } else {
          const smartCards = available.filter(c => c >= 6);
          logicPick = smartCards.length > 0 ? smartCards[Math.floor(Math.random() * smartCards.length)] : Math.max(...available);
        }
      }

      const difficultyInstruction = difficulty === "medium"
        ? "Play at medium skill. Occasionally make suboptimal choices."
        : `Play as a PERFECT strategist. Pre-selected card: ${logicPick}. Never pick below 5 unless forced.`;

      const prompt = `You are a card game AI at ${difficulty.toUpperCase()} difficulty. ${difficultyInstruction}
YOUR CARDS: ${available.join(", ")}
PLAYER HISTORY: ${playedCards}
AGGRESSION SCORE: ${aiMemory.aggressiveScore.toFixed(2)}
HIGH CARDS LEFT (8-12): ${remainingHighCards}
LOW CARDS LEFT (1-4): ${remainingLowCards}
PRE-CALCULATED BEST: ${logicPick}
Reply with ONLY a single number from your cards.`;

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
      );
      const data = await res.json();
      const picked = parseInt(data.candidates[0].content.parts[0].text.trim());
      if (difficulty === "hard" && available.includes(picked)) return picked > logicPick - 2 ? picked : logicPick;
      if (available.includes(picked)) return picked;
      return logicPick;
    } catch (e) { console.error("Gemini error:", e); }
    return available[Math.floor(Math.random() * available.length)];
  };

  const playCard = async (playerCard) => {
    if (gameOver || isThinking || !gameStarted) return;
    clearInterval(timerRef.current);
    setIsThinking(true);
    try {

      const aiCard = await chooseAiCard();
      const special = SPECIAL_CARDS[playerCard];
      const event = currentEvent;

      // Remove from decks
      setPlayerDeck((prev) => prev.filter((c) => c !== playerCard));
      setAiDeck((prev) => prev.filter((c) => c !== aiCard));

      // Replenish hand
      setPlayerHand((prev) => {
        const newHand = prev.filter((c) => c !== playerCard);
        const notInHand = playerDeck.filter((c) => c !== playerCard && !newHand.includes(c));
        if (notInHand.length > 0) {
          const shuffled = shuffle([...notInHand]);
          newHand.push(shuffled[0]);
        }
        return newHand;
      });

      updateAiMemory(playerCard);

      // Determine winner with special logic
      let rawPlayerWins = false;
      let rawAiWins = false;

      // Card 7 Mirror — always draw
      if (playerCard === 7) {
        rawPlayerWins = false;
        rawAiWins = false;
      }
      // Card 1 Underdog — beats 12
      else if (playerCard === 1 && aiCard === 12) {
        rawPlayerWins = true;
      }
      // Chaos event — lower wins
      else if (event?.id === "chaos") {
        if (playerCard < aiCard) rawPlayerWins = true;
        else if (aiCard < playerCard) rawAiWins = true;
      }
      else {
        if (playerCard > aiCard) rawPlayerWins = true;
        else if (aiCard > playerCard) rawAiWins = true;
      }

      let roundResult = "Draw";
      let nextPlayerWins = playerWins;
      let nextAiWins = aiWins;
      let msgExtra = "";

      if (rawPlayerWins) {
        roundResult = "You Win";
        const pts = (playerCard === 11 || event?.id === "double") ? 2 : 1;
        nextPlayerWins += pts;
        if (pts === 2) msgExtra = " (+2 pts!)";
      } else if (rawAiWins) {
        roundResult = "AI Wins";
        nextAiWins += 1;
        if (playerCard === 6) {
          setPlayerDeck((prev) => shuffle([...prev, aiCard]));
          setStolenCard(aiCard);
          msgExtra = ` 🪝 Steal! You recovered card ${aiCard}!`;
        }
        if (event?.id === "double") {
          nextPlayerWins = Math.max(0, nextPlayerWins - 1);
          msgExtra = " (-1 pt from Double or Nothing!)";
        }
      }

      // Set wins once at the end
      setPlayerWins(nextPlayerWins);
      setAiWins(nextAiWins);

      setLastBattle({ playerCard, aiCard, roundResult, specialName: special?.name, specialEmoji: special?.emoji, specialColor: special?.color, eventName: event?.name });
      setHistory((prev) => [{ round, playerCard, aiCard, result: roundResult, special: special?.name, event: event?.name }, ...prev]);
      setRound((prev) => prev + 1);
      setCurrentEvent(null);
      setIsThinking(false);
      setAiCardFlipped(false);
      setTimeout(() => setAiCardFlipped(true), 300);

      if (nextPlayerWins >= 3) { setMessage("🏆 You beat the Brainrot AI!"); return; }
      if (nextAiWins >= 3) { setMessage("🤖 Brainrot AI adapted and defeated you."); return; }

      if (playerCard === 7) setMessage(`🪞 Mirror! Both cards cancel out. Draw round.`);
      else if (playerCard === 1 && aiCard === 12) setMessage(`⚡ UNDERDOG! Card 1 slays Card 12!${msgExtra}`);
      else if (roundResult === "You Win") setMessage(`🔥 Your ${playerCard} crushed AI's ${aiCard}!${msgExtra}`);
      else if (roundResult === "AI Wins") setMessage(`💀 AI's ${aiCard} outplayed your ${playerCard}!${msgExtra}`);
      else setMessage("⚖️ Equal power clash. Draw round.");
    } catch (err) {
      console.error("playCard crashed:", err);
      setIsThinking(false);
    }
  };

  const getAiMood = () => {
    const a = aiMemory.roundsObserved > 0 ? aiMemory.aggressiveScore / aiMemory.roundsObserved : 0;
    if (a > 0.5) return "AI thinks you play aggressively 😈";
    if (a < -0.1) return "AI thinks you save strong cards 🧠";
    return "AI is still learning your brainrot strategy 🤖";
  };

  // Timer
  useEffect(() => {
    if (gameOver || isThinking || !gameStarted) { clearInterval(timerRef.current); return; }
    setTimeLeft(15);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          const card = playerHand[Math.floor(Math.random() * playerHand.length)];
          if (card) playCard(card);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [round, gameOver, isThinking, gameStarted]);

  // Draw initial hand
  useEffect(() => {
    if (gameStarted && playerHand.length === 0) {
      const shuffled = shuffle([...playerDeck]);
      setPlayerHand(shuffled.slice(0, 4));
    }
  }, [gameStarted]);

  // Trigger random event every 3 rounds
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    if (round > 1 && (round - 1) % 3 === 0) {
      const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
      setCurrentEvent(event);
      setShowEventBanner(true);
      setTimeout(() => setShowEventBanner(false), 3000);
    }
  }, [round]);

  const smartPct = Math.round(Math.min(aiMemory.roundsObserved / 10, 1) * 100);
  const aggrLevel = aiMemory.roundsObserved > 0 ? aiMemory.aggressiveScore / aiMemory.roundsObserved : 0;
  const aggrPct = Math.round(((aggrLevel + 1) / 2) * 100);

  const drawMoreCards = () => {
    const notInHand = playerDeck.filter((c) => !playerHand.includes(c));
    const shuffled = shuffle([...notInHand]);
    setPlayerHand((prev) => [...prev, ...shuffled.slice(0, 4)]);
  };

  return (
    <div className="min-h-screen text-white font-sans relative overflow-hidden" style={{
      background: "linear-gradient(180deg, #080015 0%, #0e0028 35%, #160040 65%, #0a0018 100%)",
    }}>
      {/* Synthwave grid */}
      <div className="fixed bottom-0 left-0 right-0 h-72 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(180,0,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(180,0,255,0.18) 1px, transparent 1px)`,
        backgroundSize: "55px 55px",
        transform: "perspective(350px) rotateX(62deg)",
        transformOrigin: "bottom center",
        opacity: 0.7,
      }} />
      <div className="fixed top-16 left-0 w-72 h-48 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(180,0,255,0.18) 0%, transparent 70%)" }} />
      <div className="fixed top-16 right-0 w-72 h-48 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(0,200,255,0.12) 0%, transparent 70%)" }} />

      {/* Random Event Banner */}
      {showEventBanner && currentEvent && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-8 py-4 rounded-2xl text-center animate-bounce"
          style={{ background: `linear-gradient(135deg, #1a0040, #0a0020)`, border: `2px solid ${currentEvent.color}`, boxShadow: `0 0 30px ${currentEvent.color}`, minWidth: 320 }}>
          <div className="text-3xl mb-1">{currentEvent.emoji}</div>
          <div className="text-xl font-black tracking-widest" style={{ color: currentEvent.color, textShadow: `0 0 10px ${currentEvent.color}` }}>{currentEvent.name}</div>
          <div className="text-xs mt-1" style={{ color: "#ccbbdd" }}>{currentEvent.desc}</div>
        </div>
      )}

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-3">

        {/* Play Screen */}
        {!gameStarted && !gameOver && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
            <div className="text-center max-w-md w-full mx-4 p-8 rounded-3xl overflow-y-auto" style={{ background: "linear-gradient(135deg, #1a0040, #0d0020)", border: "2px solid #b400ff", boxShadow: "0 0 50px rgba(180,0,255,0.5)", maxHeight: "90vh" }}>
              <div className="text-6xl mb-3">🧠</div>
              <h2 className="text-3xl font-black mb-2" style={{ color: "#ff00ff", textShadow: "0 0 20px #ff00ff", fontFamily: "monospace", letterSpacing: "0.05em" }}>BRAINROT CARD DUEL</h2>
              <p className="text-xs mb-4" style={{ color: "#cc88ff" }}>First to 3 round wins</p>

              {/* Difficulty */}
              <div className="flex gap-2 mb-4">
                {["easy", "medium", "hard"].map((d) => (
                  <button key={d} onClick={() => setDifficulty(d)} className="flex-1 py-2 rounded-xl font-black text-xs tracking-widest transition-all hover:scale-105"
                    style={{
                      background: difficulty === d ? d === "easy" ? "linear-gradient(90deg,#00aa44,#00ff88)" : d === "medium" ? "linear-gradient(90deg,#aa6600,#ffaa00)" : "linear-gradient(90deg,#aa0000,#ff0055)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${difficulty === d ? d === "easy" ? "#00ff88" : d === "medium" ? "#ffaa00" : "#ff0055" : "rgba(255,255,255,0.15)"}`,
                      color: difficulty === d ? "white" : "#666677",
                      boxShadow: difficulty === d ? `0 0 12px ${d === "easy" ? "rgba(0,255,136,0.4)" : d === "medium" ? "rgba(255,170,0,0.4)" : "rgba(255,0,85,0.4)"}` : "none",
                    }}>
                    {d === "easy" ? "😌 EASY" : d === "medium" ? "😐 MEDIUM" : "😈 HARD"}
                  </button>
                ))}
              </div>

              {/* How to Play */}
              <div className="text-left rounded-xl p-4 mb-4 space-y-1.5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,0,255,0.25)" }}>
                <div className="text-xs font-black tracking-widest mb-2" style={{ color: "#ff00ff" }}>HOW TO PLAY</div>
                <div className="text-xs" style={{ color: "#aa88cc" }}>🎴 Each player has <span style={{ color: "#ffcc00" }}>12 cards</span> numbered 1–12</div>
                <div className="text-xs" style={{ color: "#aa88cc" }}>👁 See <span style={{ color: "#ffcc00" }}>4 random cards</span> in your hand at a time</div>
                <div className="text-xs" style={{ color: "#aa88cc" }}>⚔️ Higher number <span style={{ color: "#00ff88" }}>wins</span> the round</div>
                <div className="text-xs" style={{ color: "#aa88cc" }}>🏆 First to <span style={{ color: "#ffcc00" }}>3 round wins</span> wins the match</div>
                <div className="text-xs" style={{ color: "#aa88cc" }}>⏱ <span style={{ color: "#ff4444" }}>15 seconds</span> to pick or AI auto-plays</div>
                <div className="text-xs" style={{ color: "#aa88cc" }}>🌀 <span style={{ color: "#ff00ff" }}>Random events</span> trigger every 3 rounds!</div>
              </div>

              {/* Special Cards */}
              <div className="text-left rounded-xl p-4 mb-5" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(180,0,255,0.25)" }}>
                <div className="text-xs font-black tracking-widest mb-2" style={{ color: "#ff00ff" }}>✨ SPECIAL CARDS</div>
                {Object.entries(SPECIAL_CARDS).map(([num, s]) => (
                  <div key={num} className="flex items-center gap-2 mb-1">
                    <span className="font-black text-xs w-4" style={{ color: s.color }}>{num}</span>
                    <span style={{ fontSize: 12 }}>{s.emoji}</span>
                    <span className="text-xs font-bold" style={{ color: s.color }}>{s.name}:</span>
                    <span className="text-xs" style={{ color: "#aa88cc" }}>{s.desc}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setGameStarted(true)} className="w-full py-3 rounded-2xl font-black text-lg tracking-widest transition-all hover:scale-105"
                style={{ background: "linear-gradient(90deg, #b400ff, #ff00cc)", boxShadow: "0 0 20px rgba(180,0,255,0.6)" }}>
                ▶ PLAY
              </button>
            </div>
          </div>
        )}

        {/* Game Over */}
        {gameOver && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
            <div className="text-center max-w-sm w-full mx-4 p-10 rounded-3xl" style={{
              background: "linear-gradient(135deg, #1a0040, #0d0020)",
              border: `2px solid ${playerWins >= 3 ? "#00ff88" : "#ff0055"}`,
              boxShadow: `0 0 50px ${playerWins >= 3 ? "rgba(0,255,136,0.5)" : "rgba(255,0,85,0.5)"}`,
            }}>
              <div className="text-7xl mb-4">{playerWins >= 3 ? "🏆" : "🤖"}</div>
              <h2 className="text-4xl font-black mb-2" style={{ color: playerWins >= 3 ? "#00ff88" : "#ff0055", textShadow: `0 0 20px ${playerWins >= 3 ? "#00ff88" : "#ff0055"}` }}>
                {playerWins >= 3 ? "YOU WIN!" : "AI WINS!"}
              </h2>
              <p className="text-sm mb-6" style={{ color: "#cc88ff" }}>{playerWins >= 3 ? "You outsmarted the Brainrot AI!" : "Brainrot AI adapted and defeated you."}</p>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="rounded-xl p-3" style={{ background: "rgba(0,255,136,0.1)", border: "1px solid #00ff88" }}>
                  <div className="text-xs" style={{ color: "#00ff88" }}>Your Wins</div>
                  <div className="text-3xl font-black" style={{ color: "#00ff88" }}>{playerWins}</div>
                </div>
                <div className="rounded-xl p-3" style={{ background: "rgba(255,0,85,0.1)", border: "1px solid #ff0055" }}>
                  <div className="text-xs" style={{ color: "#ff0055" }}>AI Wins</div>
                  <div className="text-3xl font-black" style={{ color: "#ff0055" }}>{aiWins}</div>
                </div>
              </div>
              <button onClick={resetGame} className="w-full py-3 rounded-2xl font-black text-lg tracking-widest transition-all hover:scale-105"
                style={{ background: "linear-gradient(90deg, #b400ff, #ff00cc)", boxShadow: "0 0 20px rgba(180,0,255,0.6)" }}>
                🔄 PLAY AGAIN
              </button>
            </div>
          </div>
        )}

        {/* Title */}
        <div className="text-center mb-3">
          <h1 className="text-4xl font-black tracking-widest mb-1" style={{ color: "#ff00ff", textShadow: "0 0 20px #ff00ff, 0 0 50px #b400ff", fontFamily: "monospace" }}>
            🧠 BRAINROT CARD DUEL
          </h1>
          <div className="inline-block px-4 py-1 rounded-full text-xs" style={{ background: "rgba(180,0,255,0.15)", border: "1px solid rgba(180,0,255,0.4)", color: "#cc88ff" }}>
            Hidden-number battle • First to 3 round wins
          </div>
        </div>

        {/* Current Event Banner (persistent small) */}
        {currentEvent && !showEventBanner && (
          <div className="mb-3 px-4 py-2 rounded-xl flex items-center gap-3" style={{ background: `rgba(0,0,0,0.6)`, border: `1px solid ${currentEvent.color}`, boxShadow: `0 0 12px ${currentEvent.color}40` }}>
            <span className="text-xl">{currentEvent.emoji}</span>
            <div>
              <span className="text-xs font-black tracking-widest" style={{ color: currentEvent.color }}>{currentEvent.name}</span>
              <span className="text-xs ml-2" style={{ color: "#aa88cc" }}>{currentEvent.desc}</span>
            </div>
          </div>
        )}

        {/* Score Row */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          {/* Player */}
          <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #001a0a, #002a10)", border: "1px solid #006622", boxShadow: "0 0 16px rgba(0,160,60,0.3)" }}>
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(rgba(0,255,80,1) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,80,1) 1px,transparent 1px)", backgroundSize: "18px 18px" }} />
            <div className="relative">
              <div className="text-xs font-bold tracking-widest mb-1" style={{ color: "#00ff88" }}>👤 Player</div>
              <div className="text-5xl font-black leading-none mb-1" style={{ color: "#00ff88", textShadow: "0 0 12px #00ff88", fontFamily: "monospace" }}>{playerWins}</div>
              <div className="text-xs" style={{ color: "#2a7a50" }}>Round Wins</div>
            </div>
          </div>

          {/* Round */}
          <div className="rounded-xl p-4 text-center relative overflow-hidden" style={{ background: "linear-gradient(135deg, #160035, #220055)", border: "1px solid #6600cc", boxShadow: "0 0 20px rgba(140,0,255,0.3)" }}>
            <div className="text-xs font-bold tracking-widest mb-0.5" style={{ color: "#9966cc" }}>ROUND</div>
            <div className="text-5xl font-black leading-none mb-2" style={{ color: "#ff00ff", textShadow: "0 0 16px #ff00ff", fontFamily: "monospace" }}>{round}</div>
            <div className="flex items-center gap-1 mb-1 justify-start">
              <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "#ff4400" }} />
              <span className="text-xs" style={{ color: "#cc7744", fontSize: "10px" }}>AI adapting ({smartPct}%)</span>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1 mb-0.5">
                <span style={{ color: "#aa6633", fontSize: "9px" }}>⚡ AI Aggression Profile</span>
                <span className="ml-auto" style={{ color: "#aa6633", fontSize: "9px" }}>({aggrPct}%)</span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${aggrPct}%`, background: "linear-gradient(90deg,#ff2200,#ff8800)", boxShadow: "0 0 4px #ff4400" }} />
              </div>
            </div>
          </div>

          {/* AI */}
          <div className="rounded-xl p-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #120028, #1c0040)", border: "1px solid #8800ee", boxShadow: "0 0 16px rgba(160,0,255,0.3)" }}>
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(rgba(200,0,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(200,0,255,1) 1px,transparent 1px)", backgroundSize: "18px 18px" }} />
            <div className="relative">
              <div className="text-xs font-bold tracking-widest mb-1" style={{ color: "#cc88ff" }}>🤖 Brainrot AI</div>
              <div className="text-5xl font-black leading-none mb-1" style={{ color: "#cc88ff", textShadow: "0 0 12px #aa00ff", fontFamily: "monospace" }}>{aiWins}</div>
              <div className="text-xs mb-2" style={{ color: "#7744aa" }}>Round Wins</div>
              <div className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(140,0,255,0.15)", border: "1px solid rgba(140,0,255,0.35)", color: "#bb88ff", fontSize: "9px" }}>
                {getAiMood()}
              </div>
            </div>
          </div>
        </div>

        {/* Battle Feed */}
        <div className="rounded-xl p-3 mb-3" style={{ background: "linear-gradient(135deg,#0c001e,#130030)", border: "1px solid rgba(140,0,255,0.35)", boxShadow: "0 0 12px rgba(140,0,255,0.1)" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span style={{ fontSize: 13 }}>🗂</span>
            <span className="text-xs font-black tracking-wide" style={{ color: "#ccbbdd" }}>Battle Feed</span>
            {lastBattle?.specialName && (
              <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(255,200,0,0.15)", border: `1px solid ${lastBattle.specialColor || "#ffcc00"}`, color: lastBattle.specialColor || "#ffcc00" }}>
                {lastBattle.specialEmoji} {lastBattle.specialName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mb-3">
            <span style={{ fontSize: 11 }}>🤖</span>
            <span className="text-xs" style={{ color: "#9988bb" }}>
              {isThinking ? <span className="animate-pulse" style={{ color: "#ff88ff" }}>Brainrot AI is thinking...</span> : message}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Your Card */}
            <div className="rounded-lg overflow-hidden relative" style={{ background: "linear-gradient(160deg,#c8a86a,#b8943a,#d4b870,#b09040,#c8a860)", border: "2px solid #8a6820", boxShadow: "inset 0 0 30px rgba(80,40,0,0.6)", minHeight: 120 }}>
              <div className="relative p-3 flex flex-col items-center justify-center h-full">
                <div className="text-xs font-bold mb-2" style={{ color: "#4a2800", letterSpacing: "0.08em" }}>Your Card</div>
                {lastBattle ? (
                  <div className="relative">
                    <img src={`/src/assets/${lastBattle.playerCard}.png`} alt="" style={{ width: 80, height: 96, objectFit: "contain", filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.8))" }} />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 font-black rounded px-2 py-0.5" style={{ background: "rgba(0,0,0,0.85)", border: "1px solid #d4aa55", color: "#f0cc66", fontSize: 11 }}>
                      {lastBattle.playerCard}
                    </div>
                    {SPECIAL_CARDS[lastBattle.playerCard] && (
                      <div className="absolute -top-2 -right-2 text-xs font-black px-1.5 py-0.5 rounded-full" style={{ background: SPECIAL_CARDS[lastBattle.playerCard].color, color: "#000", fontSize: 9 }}>
                        {SPECIAL_CARDS[lastBattle.playerCard].emoji}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center opacity-30" style={{ width: 80, height: 96, border: "2px dashed #8a6820", borderRadius: 6, color: "#6a4010", fontSize: 28 }}>🂠</div>
                )}
              </div>
            </div>

            {/* AI Card */}
            <div className="rounded-lg overflow-hidden relative" style={{ background: "linear-gradient(160deg,#16003a,#220055,#180040,#0e0028)", border: "2px solid #5500aa", boxShadow: "inset 0 0 25px rgba(100,0,200,0.3)", minHeight: 120 }}>
              <div className="relative p-3 flex flex-col items-center justify-center h-full">
                <div className="text-xs font-bold mb-2" style={{ color: "#aa77ff", letterSpacing: "0.08em" }}>AI Card</div>
                {lastBattle ? (
                  <div className="card-flip relative" style={{ width: 80, height: 96 }}>
                    <div className={`card-flip-inner w-full h-full ${aiCardFlipped ? "flipped" : ""}`}>
                      <div className="card-front w-full h-full rounded flex items-center justify-center text-3xl" style={{ background: "linear-gradient(135deg,#2a0055,#1a0035)", border: "1px solid #5500aa" }}>🂠</div>
                      <div className="card-back w-full h-full rounded overflow-hidden relative">
                        <img src={`/src/assets/${lastBattle.aiCard}.png`} alt="" className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.8))" }} />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 font-black rounded px-2 py-0.5" style={{ background: "rgba(0,0,0,0.85)", border: "1px solid #aa77ff", color: "#cc99ff", fontSize: 11 }}>
                          {lastBattle.aiCard}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center opacity-30" style={{ width: 80, height: 96, border: "2px dashed #5500aa", borderRadius: 6, color: "#7733cc", fontSize: 28 }}>🂠</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Your Hand */}
        <div className="rounded-xl mb-0" style={{ background: "linear-gradient(180deg,#2a2a2a,#1e1e1e,#282828)", border: "1px solid #444", boxShadow: "0 4px 20px rgba(0,0,0,0.7)" }}>
          <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ color: "#ee2244", fontSize: 13 }}>🎴</span>
                <span className="font-black text-sm" style={{ color: "#dd55ff" }}>Your Hand:</span>
                <span style={{ color: "#886699", fontSize: 11 }}>SELECT YOUR BRAINROT DESTINY</span>
              </div>
              <div style={{ color: "#554466", fontSize: 10, marginTop: 2 }}>Pick carefully. AI cannot see your choice beforehand.</div>
            </div>
            <button onClick={resetGame} className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all hover:scale-105 shrink-0 ml-3"
              style={{ background: "rgba(0,160,200,0.18)", border: "1px solid #0088bb", color: "#44bbdd" }}>
              Reset Match
            </button>
          </div>

          <div className="px-3 py-3 relative" style={{ background: "linear-gradient(180deg,#232323,#1a1a1a)", borderRadius: "0 0 10px 10px" }}>
            <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none" style={{ background: "linear-gradient(180deg,rgba(0,0,0,0.4),transparent)" }} />
            {/* Timer */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-1 rounded-full transition-all duration-1000" style={{ width: `${(timeLeft / 15) * 100}%`, background: timeLeft <= 5 ? "#ff0055" : "linear-gradient(90deg,#b400ff,#ff00cc)", boxShadow: timeLeft <= 5 ? "0 0 5px #ff0055" : "0 0 5px #ff00ff" }} />
              </div>
              <span style={{ color: timeLeft <= 5 ? "#ff0055" : "#ff00ff", fontSize: 10, fontWeight: "bold", minWidth: 24, textAlign: "right" }}>{timeLeft}s</span>
            </div>

            {/* Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {playerHand.map((card) => {
                const special = SPECIAL_CARDS[card];
                const isBlind = currentEvent?.id === "blind";
                return (
                  <button key={card} onClick={() => playCard(card)} disabled={gameOver || isThinking}
                    className="relative flex flex-col items-center justify-center overflow-hidden disabled:opacity-40"
                    style={{ aspectRatio: "3/4", borderRadius: 10, background: "linear-gradient(160deg,#1e0040,#120028)", border: `1px solid ${special ? special.color : "rgba(180,0,255,0.5)"}`, boxShadow: special ? `0 0 12px ${special.color}66` : "0 2px 8px rgba(0,0,0,0.6)", transition: "transform 0.15s, box-shadow 0.15s", cursor: "pointer", padding: "4px 4px 16px 4px" }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-8px) scale(1.06)"; e.currentTarget.style.boxShadow = `0 10px 24px rgba(0,0,0,0.8), 0 0 22px ${special ? special.color : "rgba(255,0,255,0.55)"}`; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = special ? `0 0 12px ${special.color}66` : "0 2px 8px rgba(0,0,0,0.6)"; }}
                  >
                    <img src={`/src/assets/${card}.png`} alt={`Card ${card}`} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", filter: isBlind ? "brightness(0.1)" : "none" }} />
                    {/* Number badge */}
                    {!isBlind && (
                      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 font-black rounded px-2 py-0.5"
                        style={{ background: "rgba(0,0,0,0.9)", border: `1px solid ${special ? special.color : "#9900ee"}`, color: special ? special.color : "#ee00ff", fontSize: 11, whiteSpace: "nowrap" }}>
                        {card}
                      </div>
                    )}
                    {/* Special badge */}
                    {special && (
                      <div className="absolute top-1 right-1 text-xs font-black px-1 py-0.5 rounded-full" style={{ background: special.color, color: "#000", fontSize: 9 }}>
                        {special.emoji}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* AI Strategy strip */}
        <div className="px-4 py-2 mb-3 text-center rounded-b-xl" style={{ background: "rgba(8,0,16,0.85)", border: "1px solid rgba(100,0,160,0.25)", borderTop: "none" }}>
          <div style={{ color: "#665577", fontSize: 11 }}>AI Strategy Detected: {getAiMood()}</div>
          <div style={{ color: "#443355", fontSize: 10 }}>Ready for your turn!</div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* AI Learning */}
          <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg,#0c001e,#130030)", border: "1px solid rgba(0,180,255,0.25)" }}>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: "#00ccff" }}>🧠 AI LEARNING STATS</div>
            <div className="space-y-2.5">
              {[
                { label: "🧠 AI Smartness", val: smartPct, color: "#00ccff", bar: "linear-gradient(90deg,#b400ff,#ec4899)" },
                { label: "😈 Aggression Read", val: aggrPct, color: "#f59e0b", bar: "linear-gradient(90deg,#22d3ee,#f59e0b)" },
                { label: "🎯 Rounds Analyzed", val: Math.min(aiMemory.roundsObserved / 10 * 100, 100), color: "#4ade80", bar: "linear-gradient(90deg,#4ade80,#22d3ee)", label2: `${aiMemory.roundsObserved}/10` },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between mb-1" style={{ fontSize: 10, color: "#4477aa" }}>
                    <span>{item.label}</span><span style={{ color: item.color }}>{item.label2 || `${item.val}%`}</span>
                  </div>
                  <div className="w-full rounded-full h-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${item.val}%`, background: item.bar, boxShadow: `0 0 5px ${item.color}` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Match History */}
          <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg,#0c001e,#130030)", border: "1px solid rgba(140,0,255,0.25)" }}>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: "#b400ff" }}>📜 MATCH HISTORY</div>
            <div className="space-y-1.5 overflow-auto pr-1" style={{ maxHeight: 180 }}>
              {history.length === 0 && <div style={{ color: "#443355", fontSize: 11 }}>No rounds played yet.</div>}
              {history.map((entry, idx) => (
                <div key={idx} className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: "rgba(140,0,255,0.07)", border: "1px solid rgba(140,0,255,0.18)" }}>
                  <div>
                    <div className="font-bold" style={{ color: "#ccaaee", fontSize: 11 }}>
                      Round {entry.round}
                      {entry.special && <span className="ml-1" style={{ color: "#ffcc00", fontSize: 9 }}>✨{entry.special}</span>}
                      {entry.event && <span className="ml-1" style={{ color: "#ff00ff", fontSize: 9 }}>🌀{typeof entry.event === "string" ? entry.event : entry.event?.name}</span>}
                    </div>
                    <div style={{ color: "#664488", fontSize: 10 }}>You: {entry.playerCard} vs AI: {entry.aiCard}</div>
                  </div>
                  <div className="font-black" style={{ fontSize: 11, color: entry.result === "You Win" ? "#00ff88" : entry.result === "AI Wins" ? "#ff0055" : "#ffcc00" }}>
                    {entry.result}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
