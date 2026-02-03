const COLORS = ["Red", "Yellow", "Green", "Blue"];
const NUMBERS = Array.from({ length: 12 }, (_, index) => index + 1);
const SPECIALS = ["Wild", "Skip"];

const deckDefinition = () => {
  const deck = new Map();
  COLORS.forEach((color) => {
    NUMBERS.forEach((number) => {
      deck.set(`${color} ${number}`, 2);
    });
  });
  deck.set("Wild", 8);
  deck.set("Skip", 4);
  return deck;
};

const normalizeCard = (raw) => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (upper === "WILD" || upper === "W") return "Wild";
  if (upper === "SKIP" || upper === "S") return "Skip";

  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;
  const color = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  const number = Number(parts[1]);
  if (!COLORS.includes(color) || Number.isNaN(number) || number < 1 || number > 12) {
    return null;
  }
  return `${color} ${number}`;
};

const parseCardList = (value) => {
  return value
    .split(/\n|,/)
    .map((line) => normalizeCard(line))
    .filter(Boolean);
};

const combination = (n, k) => {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const limit = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= limit; i += 1) {
    result *= (n - (limit - i)) / i;
  }
  return result;
};

const probabilityAtLeastOne = (total, successes, draws) => {
  if (successes <= 0 || draws <= 0 || total <= 0) return 0;
  if (draws > total) return 1;
  const numerator = combination(total - successes, draws);
  const denominator = combination(total, draws);
  if (denominator === 0) return 0;
  return 1 - numerator / denominator;
};

const state = {
  players: [],
};

const playerTemplate = document.getElementById("player-template");
const playersContainer = document.getElementById("players");
const buildButton = document.getElementById("build-players");
const playerCountInput = document.getElementById("player-count");
const handSizeInput = document.getElementById("hand-size");
const globalCardsInput = document.getElementById("global-cards");
const deckSummary = document.getElementById("deck-summary");
const playerSummary = document.getElementById("player-summary");

const buildPlayers = () => {
  const count = Number(playerCountInput.value);
  playersContainer.innerHTML = "";
  state.players = [];

  for (let i = 0; i < count; i += 1) {
    const clone = document.importNode(playerTemplate.content, true);
    const card = clone.querySelector(".player-card");
    const title = clone.querySelector("h3");
    title.textContent = `Player ${i + 1}`;

    const knownHand = clone.querySelector(".known-hand");
    const discarded = clone.querySelector(".discarded");
    const unknownCount = clone.querySelector(".unknown-count");
    const probability = clone.querySelector(".player-probability");

    const player = {
      element: card,
      knownHand,
      discarded,
      unknownCount,
      probability,
    };

    const updateUnknown = () => {
      const handSize = Number(handSizeInput.value);
      const knownCards = parseCardList(knownHand.value).length;
      const remaining = Math.max(handSize - knownCards, 0);
      if (!unknownCount.dataset.manual) {
        unknownCount.value = remaining;
      }
    };

    knownHand.addEventListener("input", () => {
      updateUnknown();
      calculate();
    });
    discarded.addEventListener("input", calculate);
    unknownCount.addEventListener("input", () => {
      unknownCount.dataset.manual = "true";
      calculate();
    });

    updateUnknown();
    state.players.push(player);
    playersContainer.appendChild(clone);
  }

  calculate();
};

const summarizeDeck = (remainingDeck) => {
  const list = document.createElement("ul");
  const entries = Array.from(remainingDeck.entries()).filter(([, count]) => count > 0);
  entries.sort((a, b) => b[1] - a[1]);
  entries.forEach(([card, count]) => {
    const item = document.createElement("li");
    item.textContent = `${card}: ${count}`;
    list.appendChild(item);
  });
  deckSummary.innerHTML = "";
  deckSummary.appendChild(list);
};

const summarizePlayers = (playerStats) => {
  playerSummary.innerHTML = "";
  playerStats.forEach((player) => {
    const section = document.createElement("div");
    section.classList.add("summary-section");
    const title = document.createElement("h4");
    title.textContent = player.name;
    const list = document.createElement("ul");
    player.topCards.forEach((card) => {
      const item = document.createElement("li");
      item.textContent = `${card.card}: ${card.probability.toFixed(1)}% (expected ${card.expected.toFixed(2)})`;
      list.appendChild(item);
    });
    section.appendChild(title);
    section.appendChild(list);
    playerSummary.appendChild(section);
  });
};

const calculate = () => {
  const deck = deckDefinition();
  const globalKnown = parseCardList(globalCardsInput.value);

  const allKnown = [...globalKnown];
  const playersData = state.players.map((player, index) => {
    const knownHand = parseCardList(player.knownHand.value);
    const discarded = parseCardList(player.discarded.value);
    const unknownCount = Number(player.unknownCount.value || 0);
    allKnown.push(...knownHand, ...discarded);

    return {
      name: `Player ${index + 1}`,
      knownHand,
      discarded,
      unknownCount,
      element: player,
    };
  });

  allKnown.forEach((card) => {
    const current = deck.get(card) ?? 0;
    deck.set(card, Math.max(current - 1, 0));
  });

  const remainingTotal = Array.from(deck.values()).reduce((sum, count) => sum + count, 0);
  summarizeDeck(deck);

  const playerSummaries = playersData.map((player) => {
    const expectations = Array.from(deck.entries()).map(([card, count]) => {
      const expected = remainingTotal > 0 ? (player.unknownCount * count) / remainingTotal : 0;
      const probability = probabilityAtLeastOne(remainingTotal, count, player.unknownCount) * 100;
      return { card, expected, probability };
    });

    expectations.sort((a, b) => b.probability - a.probability);
    const topCards = expectations.slice(0, 6);

    const probabilityList = document.createElement("ul");
    topCards.forEach((item) => {
      const entry = document.createElement("li");
      entry.textContent = `${item.card}: ${item.probability.toFixed(1)}% (expected ${item.expected.toFixed(2)})`;
      probabilityList.appendChild(entry);
    });

    player.element.probability.innerHTML = `
      <strong>Top probabilities</strong>
      <p>Total unknown cards: ${player.unknownCount}</p>
    `;
    player.element.probability.appendChild(probabilityList);

    return {
      name: player.name,
      topCards,
    };
  });

  summarizePlayers(playerSummaries);
};

buildButton.addEventListener("click", buildPlayers);
playerCountInput.addEventListener("input", buildPlayers);
handSizeInput.addEventListener("input", buildPlayers);
globalCardsInput.addEventListener("input", calculate);

buildPlayers();
