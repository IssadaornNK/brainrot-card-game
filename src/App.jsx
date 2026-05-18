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
    try {
      const prompt = `You are playing a card game. You have these cards: ${available.join(", ")}. 
The player has played these cards before: ${Object.entries(aiMemory.playerPatterns).map(([k, v]) => `${k} (${v}x)`).join(", ") || "none yet"}.
Player aggression score: ${aiMemory.aggressiveScore.toFixed(2)}.
Pick ONE card number from your available cards to maximize your chance of winning. 
Reply with ONLY a single number, nothing else.`;
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      const data = await res.json();
      const text = data.candidates[0].content.parts[0].text.trim();
      const picked = parseInt(text);
      if (available.includes(picked)) return picked;
    } catch (e) {
      console.error("Gemini error:", e);
    }
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
    setHistory((prev) => [{ round, playerCard, aiCard, result: roundResult }, ...prev]);
    setRound((prev) => prev + 1);
    setIsThinking(false);
    setAiCardFlipped(false);
    setTimeout(() => setAiCardFlipped(true), 300);
    if (nextPlayerWins >= 3) { setMessage("🏆 You beat the Brainrot AI!"); return; }
    if (nextAiWins >= 3) { setMessage("🤖 Brainrot AI adapted and defeated you."); return; }
    if (roundResult === "You Win") setMessage(`🔥 Your ${playerCard} crushed the AI's hidden card!`);
    else if (roundResult === "AI Wins") setMessage(`💀 Brainrot AI outplayed you with ${aiCard}!`);
    else setMessage("⚖️ Equal power clash. Draw round.");
  };

  const getAiMood = () => {
    const aggressionLevel = aiMemory.roundsObserved > 0 ? aiMemory.aggressiveScore / aiMemory.roundsObserved : 0;
    if (aggressionLevel > 0.5) return "AI thinks you play aggressively 😈";
    if (aggressionLevel < -0.1) return "AI thinks you save strong cards 🧠";
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

  const smartPct = Math.round(Math.min(aiMemory.roundsObserved / 10, 1) * 100);
  const aggrLevel = aiMemory.roundsObserved > 0 ? aiMemory.aggressiveScore / aiMemory.roundsObserved : 0;
  const aggrPct = Math.round(((aggrLevel + 1) / 2) * 100);

  return (
    <div className="min-h-screen text-white font-sans relative overflow-hidden" style={{
      background: "linear-gradient(180deg, #080015 0%, #0e0028 35%, #160040 65%, #0a0018 100%)",
    }}>
      {/* Synthwave grid floor */}
      <div className="fixed bottom-0 left-0 right-0 h-72 pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(180,0,255,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(180,0,255,0.18) 1px, transparent 1px)`,
        backgroundSize: "55px 55px",
        transform: "perspective(350px) rotateX(62deg)",
        transformOrigin: "bottom center",
        opacity: 0.7,
      }} />
      {/* Neon clouds / glow orbs */}
      <div className="fixed top-16 left-0 w-72 h-48 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(180,0,255,0.18) 0%, transparent 70%)" }} />
      <div className="fixed top-16 right-0 w-72 h-48 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(0,200,255,0.12) 0%, transparent 70%)" }} />
      <div className="fixed top-32 left-12 w-48 h-32 pointer-events-none rounded-full" style={{ background: "rgba(180,80,255,0.13)", filter: "blur(18px)" }} />
      <div className="fixed top-32 right-12 w-48 h-32 pointer-events-none rounded-full" style={{ background: "rgba(0,200,255,0.10)", filter: "blur(18px)" }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-3">

        {/* Play Screen */}
        {!gameStarted && !gameOver && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
            <div className="text-center max-w-md mx-4 p-10 rounded-3xl" style={{ background: "linear-gradient(135deg, #1a0040, #0d0020)", border: "2px solid #b400ff", boxShadow: "0 0 50px rgba(180,0,255,0.5), inset 0 0 40px rgba(180,0,255,0.05)" }}>
              <div className="text-7xl mb-4">🧠</div>
              <h2 className="text-4xl font-black mb-2" style={{ color: "#ff00ff", textShadow: "0 0 20px #ff00ff, 0 0 50px #b400ff", fontFamily: "monospace", letterSpacing: "0.05em" }}>BRAINROT CARD DUEL</h2>
              <p className="mb-1 text-sm" style={{ color: "#cc88ff" }}>First to 3 round wins</p>
              <p className="text-xs mb-8" style={{ color: "#886699" }}>You have 15 seconds per round. AI learns your strategy.</p>
              <button onClick={() => setGameStarted(true)} className="w-full py-4 rounded-2xl font-black text-xl transition-all hover:scale-105" style={{ background: "linear-gradient(90deg, #b400ff, #ff00cc)", boxShadow: "0 0 25px rgba(180,0,255,0.7)" }}>
                ▶ PLAY
              </button>
            </div>
          </div>
        )}

        {/* Game Over Screen */}
        {gameOver && (
          <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(10px)" }}>
            <div className="text-center max-w-md mx-4 p-10 rounded-3xl" style={{
              background: "linear-gradient(135deg, #1a0040, #0d0020)",
              border: `2px solid ${playerWins >= 3 ? "#00ffcc" : "#ff0055"}`,
              boxShadow: `0 0 50px ${playerWins >= 3 ? "rgba(0,255,200,0.5)" : "rgba(255,0,85,0.5)"}`,
            }}>
              <div className="text-7xl mb-4">{playerWins >= 3 ? "🏆" : "🤖"}</div>
              <h2 className="text-4xl font-black mb-2" style={{ color: playerWins >= 3 ? "#00ffcc" : "#ff0055", textShadow: `0 0 20px ${playerWins >= 3 ? "#00ffcc" : "#ff0055"}` }}>
                {playerWins >= 3 ? "YOU WIN!" : "AI WINS!"}
              </h2>
              <p className="mb-6 text-sm" style={{ color: "#cc88ff" }}>{playerWins >= 3 ? "You outsmarted the Brainrot AI!" : "Brainrot AI adapted and defeated you."}</p>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-2xl p-4" style={{ background: "rgba(0,255,200,0.1)", border: "1px solid rgba(0,255,200,0.3)" }}>
                  <div className="text-xs" style={{ color: "#88ffee" }}>Your Wins</div>
                  <div className="text-4xl font-black" style={{ color: "#00ffcc" }}>{playerWins}</div>
                </div>
                <div className="rounded-2xl p-4" style={{ background: "rgba(255,0,85,0.1)", border: "1px solid rgba(255,0,85,0.3)" }}>
                  <div className="text-xs" style={{ color: "#ff88aa" }}>AI Wins</div>
                  <div className="text-4xl font-black" style={{ color: "#ff0055" }}>{aiWins}</div>
                </div>
              </div>
              <button onClick={resetGame} className="w-full py-4 rounded-2xl font-black text-xl transition-all hover:scale-105" style={{ background: "linear-gradient(90deg, #b400ff, #ff00cc)", boxShadow: "0 0 25px rgba(180,0,255,0.7)" }}>
                🔄 PLAY AGAIN
              </button>
            </div>
          </div>
        )}

        {/* ── HEADER ── */}
        <div className="text-center mb-4">
          <h1 className="text-4xl font-black tracking-widest mb-1" style={{ color: "#ff00ff", textShadow: "0 0 18px #ff00ff, 0 0 50px #b400ff", fontFamily: "monospace", letterSpacing: "0.08em" }}>
            🧠 BRAINROT CARD DUEL
          </h1>
          <div className="inline-block px-4 py-1 rounded-full text-xs" style={{ background: "rgba(80,0,120,0.4)", border: "1px solid rgba(180,0,255,0.4)", color: "#bb88ee" }}>
            Hidden-number battle • First to 3 round wins
          </div>
        </div>

        {/* ── SCORE ROW ── */}
        <div className="grid grid-cols-3 gap-3 mb-3">

          {/* Player box — green circuit board style */}
          <div className="rounded-xl p-4 relative overflow-hidden" style={{
            background: "linear-gradient(135deg, #061a0c, #0a2814)",
            border: "1px solid #1a7a40",
            boxShadow: "0 0 16px rgba(0,180,80,0.25)",
          }}>
            {/* PCB trace decoration */}
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{
              backgroundImage: "linear-gradient(rgba(0,255,100,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,100,0.3) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }} />
            <div className="relative">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs" style={{ color: "#44cc77" }}>👤</span>
                <span className="text-xs font-bold" style={{ color: "#44cc77", letterSpacing: "0.05em" }}>Player</span>
              </div>
              <div className="text-5xl font-black leading-none mb-1" style={{ color: "#00ff88", textShadow: "0 0 12px #00ff88", fontFamily: "monospace" }}>{playerWins}</div>
              <div className="text-xs" style={{ color: "#2a7a50" }}>Round Wins</div>
            </div>
          </div>

          {/* Round box — purple center */}
          <div className="rounded-xl p-4 text-center relative overflow-hidden" style={{
            background: "linear-gradient(135deg, #160035, #220055)",
            border: "1px solid #6600cc",
            boxShadow: "0 0 20px rgba(140,0,255,0.3)",
          }}>
            <div className="text-xs font-bold tracking-widest mb-0.5" style={{ color: "#9966cc" }}>ROUND</div>
            <div className="text-5xl font-black leading-none mb-2" style={{ color: "#ff00ff", textShadow: "0 0 16px #ff00ff", fontFamily: "monospace" }}>{round}</div>
            {/* AI adapting line */}
            <div className="flex items-center gap-1 mb-1 justify-start">
              <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: "#ff4400" }} />
              <span className="text-xs" style={{ color: "#cc7744", fontSize: "10px" }}>AI is adapting to your "Brainrot" &nbsp;({smartPct}%)</span>
            </div>
            {/* Aggression bar */}
            <div className="text-left">
              <div className="flex items-center gap-1 mb-0.5">
                <span className="text-xs" style={{ color: "#ff4400", fontSize: "9px" }}>⚡</span>
                <span style={{ color: "#aa6633", fontSize: "9px" }}>AI Aggression Profile</span>
                <span className="ml-auto" style={{ color: "#aa6633", fontSize: "9px" }}>({aggrPct}%)</span>
              </div>
              <div className="w-full rounded-full h-1.5" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${aggrPct}%`, background: "linear-gradient(90deg, #ff2200, #ff8800)", boxShadow: "0 0 4px #ff4400" }} />
              </div>
            </div>
          </div>

          {/* Brainrot AI box — purple glow */}
          <div className="rounded-xl p-4 relative overflow-hidden" style={{
            background: "linear-gradient(135deg, #120028, #1c0040)",
            border: "1px solid #8800ee",
            boxShadow: "0 0 16px rgba(160,0,255,0.3)",
          }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle, rgba(180,0,255,0.25) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} />
            <div className="relative">
              <div className="flex items-center gap-1 mb-1">
                <span className="text-xs">🤖</span>
                <span className="text-xs font-bold" style={{ color: "#cc88ff", letterSpacing: "0.05em" }}>Brainrot AI</span>
              </div>
              <div className="text-5xl font-black leading-none mb-1" style={{ color: "#cc88ff", textShadow: "0 0 12px #aa00ff", fontFamily: "monospace" }}>{aiWins}</div>
              <div className="text-xs mb-2" style={{ color: "#7744aa" }}>Round Wins</div>
              <div className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(140,0,255,0.15)", border: "1px solid rgba(140,0,255,0.35)", color: "#bb88ff", fontSize: "9px", lineHeight: "1.4" }}>
                AI Status: Highly Amused by your "tactics"
              </div>
            </div>
          </div>
        </div>

        {/* ── BATTLE FEED ── */}
        <div className="rounded-xl p-3 mb-3" style={{
          background: "linear-gradient(135deg, #0c001e, #130030)",
          border: "1px solid rgba(140,0,255,0.35)",
          boxShadow: "0 0 12px rgba(140,0,255,0.1)",
        }}>
          {/* Header */}
          <div className="flex items-center gap-2 mb-1.5">
            <span style={{ fontSize: "13px" }}>🗂</span>
            <span className="text-xs font-black tracking-wide" style={{ color: "#ccbbdd" }}>Battle Feed</span>
          </div>
          {/* Message */}
          <div className="flex items-center gap-1.5 mb-3">
            <span style={{ fontSize: "11px" }}>🤖</span>
            <span className="text-xs" style={{ color: "#9988bb" }}>
              {isThinking ? <span className="animate-pulse" style={{ color: "#ff88ff" }}>Brainrot AI is thinking...</span> : message}
            </span>
          </div>

          {/* Card display area */}
          <div className="grid grid-cols-2 gap-3">

            {/* YOUR CARD — parchment / map paper */}
            <div className="rounded-lg overflow-hidden relative" style={{
              background: "linear-gradient(160deg, #c8a86a 0%, #b8943a 20%, #d4b870 45%, #b09040 70%, #c8a860 100%)",
              border: "2px solid #8a6820",
              boxShadow: "inset 0 0 30px rgba(80,40,0,0.6), 0 2px 8px rgba(0,0,0,0.5)",
              minHeight: "120px",
            }}>
              {/* Aged paper texture overlay */}
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "radial-gradient(ellipse at 20% 30%, rgba(255,255,255,0.12) 0%, transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(100,60,0,0.2) 0%, transparent 50%)",
              }} />
              <div className="relative p-3 flex flex-col items-center justify-center h-full">
                <div className="text-xs font-bold mb-2" style={{ color: "#4a2800", textShadow: "0 1px 2px rgba(255,220,100,0.4)", letterSpacing: "0.08em" }}>Your Card</div>
                {lastBattle ? (
                  <div className="relative">
                    <img src={`/src/assets/${lastBattle.playerCard}.png`} alt={`Card ${lastBattle.playerCard}`}
                      style={{ width: "80px", height: "96px", objectFit: "contain", filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.8))" }} />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 font-black rounded px-2 py-0.5" style={{ background: "rgba(0,0,0,0.85)", border: "1px solid #d4aa55", color: "#f0cc66", fontSize: "11px" }}>
                      {lastBattle.playerCard}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center opacity-30" style={{ width: "80px", height: "96px", border: "2px dashed #8a6820", borderRadius: "6px", color: "#6a4010", fontSize: "28px" }}>🂠</div>
                )}
              </div>
            </div>

            {/* AI CARD — dark purple */}
            <div className="rounded-lg overflow-hidden relative" style={{
              background: "linear-gradient(160deg, #16003a 0%, #220055 40%, #180040 70%, #0e0028 100%)",
              border: "2px solid #5500aa",
              boxShadow: "inset 0 0 25px rgba(100,0,200,0.3), 0 2px 8px rgba(0,0,0,0.5)",
              minHeight: "120px",
            }}>
              <div className="absolute inset-0 pointer-events-none" style={{
                backgroundImage: "radial-gradient(ellipse at 50% 20%, rgba(180,0,255,0.15) 0%, transparent 60%)",
              }} />
              <div className="relative p-3 flex flex-col items-center justify-center h-full">
                <div className="text-xs font-bold mb-2" style={{ color: "#aa77ff", letterSpacing: "0.08em" }}>AI Card</div>
                {lastBattle ? (
                  <div className="card-flip relative" style={{ width: "80px", height: "96px" }}>
                    <div className={`card-flip-inner w-full h-full ${aiCardFlipped ? "flipped" : ""}`}>
                      <div className="card-front w-full h-full rounded flex items-center justify-center text-3xl" style={{ background: "linear-gradient(135deg, #2a0055, #1a0035)", border: "1px solid #5500aa" }}>🂠</div>
                      <div className="card-back w-full h-full rounded overflow-hidden relative">
                        <img src={`/src/assets/${lastBattle.aiCard}.png`} alt={`Card ${lastBattle.aiCard}`} className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 3px 8px rgba(0,0,0,0.8))" }} />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 font-black rounded px-2 py-0.5" style={{ background: "rgba(0,0,0,0.85)", border: "1px solid #aa77ff", color: "#cc99ff", fontSize: "11px" }}>
                          {lastBattle.aiCard}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center opacity-30" style={{ width: "80px", height: "96px", border: "2px dashed #5500aa", borderRadius: "6px", color: "#7733cc", fontSize: "28px" }}>🂠</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── YOUR HAND — metal tray ── */}
        <div className="rounded-xl mb-0" style={{
          background: "linear-gradient(180deg, #2a2a2a 0%, #1e1e1e 30%, #282828 100%)",
          border: "1px solid #444",
          boxShadow: "0 4px 20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.5)",
        }}>
          {/* Top bar of the tray */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <div className="flex items-center gap-2">
                <span style={{ color: "#ee2244", fontSize: "13px" }}>🎴</span>
                <span className="font-black text-sm" style={{ color: "#dd55ff" }}>Your Hand:</span>
                <span style={{ color: "#886699", fontSize: "11px" }}>YOUR DECK: SELECT YOUR BRAINROT DESTINY (Pick carefully)</span>
              </div>
              <div style={{ color: "#554466", fontSize: "10px", marginTop: "2px" }}>Pick carefully. AI cannot see your choice beforehand.</div>
            </div>
            <button
              onClick={resetGame}
              className="px-3 py-1.5 rounded-lg font-bold text-xs transition-all hover:scale-105 shrink-0 ml-3"
              style={{ background: "rgba(0,160,200,0.18)", border: "1px solid #0088bb", color: "#44bbdd" }}
            >
              Reset Match
            </button>
          </div>

          {/* Metal tray surface — card area */}
          <div className="px-3 py-3 relative" style={{
            background: "linear-gradient(180deg, #232323 0%, #1a1a1a 100%)",
            borderRadius: "0 0 10px 10px",
          }}>
            {/* Inset shadow top */}
            <div className="absolute top-0 left-0 right-0 h-2 pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 100%)" }} />

            {/* Timer bar */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 rounded-full h-1" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-1 rounded-full transition-all duration-1000" style={{
                  width: `${(timeLeft / 15) * 100}%`,
                  background: timeLeft <= 5 ? "#ff0055" : "linear-gradient(90deg, #b400ff, #ff00cc)",
                  boxShadow: timeLeft <= 5 ? "0 0 5px #ff0055" : "0 0 5px #ff00ff",
                }} />
              </div>
              <span style={{ color: timeLeft <= 5 ? "#ff0055" : "#ff00ff", fontSize: "10px", fontWeight: "bold", minWidth: "24px", textAlign: "right" }}>
                {timeLeft}s
              </span>
            </div>

            {/* Cards — 6-column grid, large size */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px" }}>
              {playerDeck.map((card) => (
                <button
                  key={card}
                  onClick={() => playCard(card)}
                  disabled={gameOver || isThinking}
                  className="relative flex flex-col items-center justify-center overflow-hidden disabled:opacity-40"
                  style={{
                    aspectRatio: "3/4",
                    borderRadius: "10px",
                    background: "linear-gradient(160deg, #1e0040, #120028)",
                    border: "1px solid rgba(180,0,255,0.5)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.6), 0 0 8px rgba(140,0,255,0.15)",
                    transition: "transform 0.15s, box-shadow 0.15s",
                    cursor: "pointer",
                    padding: "4px 4px 16px 4px",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-8px) scale(1.06)"; e.currentTarget.style.boxShadow = "0 10px 24px rgba(0,0,0,0.8), 0 0 22px rgba(255,0,255,0.55)"; e.currentTarget.style.borderColor = "#ff00ff"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.6), 0 0 8px rgba(140,0,255,0.15)"; e.currentTarget.style.borderColor = "rgba(180,0,255,0.5)"; }}
                >
                  <img src={`/src/assets/${card}.png`} alt={`Card ${card}`} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 font-black rounded px-2 py-0.5"
                    style={{ background: "rgba(0,0,0,0.9)", border: "1px solid #9900ee", color: "#ee00ff", fontSize: "11px", whiteSpace: "nowrap" }}>
                    {card}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Strategy strip — right below tray, same width */}
        <div className="px-4 py-2 mb-3 text-center rounded-b-xl" style={{
          background: "rgba(8,0,16,0.85)",
          border: "1px solid rgba(100,0,160,0.25)",
          borderTop: "none",
        }}>
          <div style={{ color: "#665577", fontSize: "11px" }}>AI Strategy Detected: {getAiMood()}</div>
          <div style={{ color: "#443355", fontSize: "10px" }}>Ready for your turn!</div>
        </div>

        {/* ── BOTTOM ROW ── */}
        <div className="grid grid-cols-2 gap-3">
          {/* AI Learning Stats */}
          <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, #0c001e, #130030)", border: "1px solid rgba(0,180,255,0.25)" }}>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: "#00ccff" }}>🧠 AI LEARNING STATS</div>
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between mb-1" style={{ fontSize: "10px", color: "#4477aa" }}>
                  <span>🧠 AI Smartness</span><span style={{ color: "#00ccff" }}>{smartPct}%</span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${smartPct}%`, background: "linear-gradient(90deg, #b400ff, #ec4899)", boxShadow: "0 0 5px #b400ff" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1" style={{ fontSize: "10px", color: "#4477aa" }}>
                  <span>😈 Aggression Read</span><span style={{ color: "#f59e0b" }}>{aggrPct}%</span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${aggrPct}%`, background: "linear-gradient(90deg, #22d3ee, #f59e0b)", boxShadow: "0 0 5px #f59e0b" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1" style={{ fontSize: "10px", color: "#4477aa" }}>
                  <span>🎯 Rounds Analyzed</span><span style={{ color: "#4ade80" }}>{aiMemory.roundsObserved}/10</span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${Math.min(aiMemory.roundsObserved / 10 * 100, 100)}%`, background: "linear-gradient(90deg, #4ade80, #22d3ee)", boxShadow: "0 0 5px #4ade80" }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#4477aa", marginBottom: "6px" }}>Most Played Numbers</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(aiMemory.playerPatterns).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([card, count]) => (
                    <div key={card} className="px-2 py-0.5 rounded font-bold" style={{ background: "rgba(180,0,255,0.15)", border: "1px solid rgba(180,0,255,0.35)", color: "#cc88ff", fontSize: "10px" }}>
                      #{card} → {count}x
                    </div>
                  ))}
                  {Object.keys(aiMemory.playerPatterns).length === 0 && <span style={{ color: "#443355", fontSize: "10px" }}>No data yet</span>}
                </div>
              </div>
            </div>
          </div>

          {/* Match History */}
          <div className="rounded-xl p-4" style={{ background: "linear-gradient(135deg, #0c001e, #130030)", border: "1px solid rgba(140,0,255,0.25)" }}>
            <div className="text-xs font-black tracking-widest mb-3" style={{ color: "#b400ff" }}>📜 MATCH HISTORY</div>
            <div className="space-y-1.5 overflow-auto pr-1" style={{ maxHeight: "160px" }}>
              {history.length === 0 && <div style={{ color: "#443355", fontSize: "11px" }}>No rounds played yet.</div>}
              {history.map((entry, idx) => (
                <div key={idx} className="rounded-lg px-3 py-2 flex items-center justify-between" style={{ background: "rgba(140,0,255,0.07)", border: "1px solid rgba(140,0,255,0.18)" }}>
                  <div>
                    <div className="font-bold" style={{ color: "#ccaaee", fontSize: "11px" }}>Round {entry.round}</div>
                    <div style={{ color: "#664488", fontSize: "10px" }}>You: {entry.playerCard} vs AI: {entry.aiCard}</div>
                  </div>
                  <div className="font-black" style={{ fontSize: "11px", color: entry.result === "You Win" ? "#00ff88" : entry.result === "AI Wins" ? "#ff0055" : "#ffcc00" }}>
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
