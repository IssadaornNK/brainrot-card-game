# 🧠 Brainrot Card Duel

A synthwave-themed card dueling game where you go head-to-head against an adaptive AI. First to 3 round wins takes the match.

---

## 🎮 How to Play

1. Select a difficulty level (Easy / Medium / Hard)
2. Click **Start Game**
3. Each round, pick a card from your hand before the 15-second timer runs out
4. Higher card wins — unless a Special Card or Random Event changes the rules
5. First to **3 wins** takes the match

---

## ⚡ Special Cards

| Card | Name | Effect |
|------|------|--------|
| 1 | **Underdog** | Beats Card 12 |
| 6 | **Steal** | If you lose, steal the AI's card back into your deck |
| 7 | **Mirror** | Always draws — no one loses this round |
| 11 | **Double** | Win = +2 points instead of 1 |

---

## 🌀 Random Events

Every 3 rounds, a random event activates:

| Event | Effect |
|-------|--------|
| **Chaos Round** 🌀 | Lower card wins this round |
| **Blind Round** 👁 | You can't see your card numbers |
| **Double or Nothing** 🎲 | Win = +2 pts, Lose = -1 pt |

---

## 🤖 AI Difficulty

| Level | Behavior |
|-------|----------|
| 😌 Easy | Always picks the lowest available card |
| 😐 Medium | 40% random, 60% strategic via pattern analysis |
| 😈 Hard | Full pattern analysis + aggression tracking |

### How the AI Learns

The AI tracks your play history every round:

- **Aggression Score** — detects if you favor high or low cards
- **Pattern Memory** — remembers which cards you've played most often
- **Adaptive Strategy** — adjusts counter-picks based on your tendencies

On Hard mode, the AI uses pre-calculated logic (`logicPick`) based on your aggression pattern, optionally validated by Gemini API if available. If the API is rate-limited, the local logic still runs every round so difficulty stays consistent.

---

## 🛠️ Tech Stack

- **React** (Vite)
- **Tailwind CSS**
- **Gemini 2.0 Flash API** (optional AI validation layer on Hard mode)

---

## 🚀 Getting Started

```bash
npm install
npm run dev
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

> The game works without a Gemini API key. Hard mode falls back to local AI logic automatically.

---

## 📁 Project Structure

```
src/
├── App.jsx          # Main game logic and UI
├── assets/          # Card images (1.png – 12.png)
└── main.jsx         # Entry point
```

---

## 📜 Notes

- Gemini API is used as a bonus validation layer on Hard mode only. The core AI logic runs locally and does not depend on it.
- If you hit Gemini's free tier rate limit (429), the game continues normally with local AI — no crash, no interruption.
