// ---- Firebase setup (config comes from firebase-config.js) ----
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

// Single shared "couple" document holds both people's data.
// Change this to something unique to you two if you want extra privacy.
const COUPLE_ID = "our-couple";
const coupleRef = db.collection("couples").doc(COUPLE_ID);

let currentPerson = null; // "me" | "her"
let state = {
  names: { me: "Me", her: "Her" },
  entries: [], // {id, author, text, photos:[dataURL...], time}
  triviaQuestions: [], // {q, correct, wrong:[...] }
  triviaScores: { me: 0, her: 0 },
  endlessHigh: { me: 0, her: 0 }
};
let pendingPhotos = [];
let syncTimer = null;

function showSyncStatus(msg) {
  const el = document.getElementById("sync-status");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => el.classList.add("hidden"), 2500);
}

// ---- Local-first save: write to localStorage immediately, push to Firestore when possible ----
function saveStateLocal() {
  localStorage.setItem("journalState", JSON.stringify(state));
}
function loadStateLocal() {
  const raw = localStorage.getItem("journalState");
  if (raw) state = JSON.parse(raw);
}
function pushStateToCloud() {
  if (!navigator.onLine) { showSyncStatus("Waiting to sync..."); return; }
  coupleRef.set(state).then(() => {}).catch(() => showSyncStatus("Waiting to sync..."));
}
function commit() {
  saveStateLocal();
  renderAll();
  pushStateToCloud();
}

// Listen for changes from the other person in real time
function listenToCloud() {
  coupleRef.onSnapshot((doc) => {
    if (doc.exists) {
      state = doc.data();
      saveStateLocal();
      renderAll();
    }
  });
}

window.addEventListener("online", () => { showSyncStatus("Back online, syncing..."); pushStateToCloud(); });

// ---- LOGIN ----
let selectedProfile = null;
document.getElementById("pick-me").onclick = () => selectProfile("me");
document.getElementById("pick-her").onclick = () => selectProfile("her");

function selectProfile(person) {
  selectedProfile = person;
  document.getElementById("pick-me").classList.toggle("selected", person === "me");
  document.getElementById("pick-her").classList.toggle("selected", person === "her");
  document.getElementById("pin-area").classList.remove("hidden");
}

document.getElementById("pin-continue").onclick = () => {
  const pin = document.getElementById("pin-input").value.trim();
  const key = "pin_" + selectedProfile;
  const savedPin = localStorage.getItem(key);
  if (!selectedProfile) return showError("Pick who you are first.");
  if (savedPin && pin === savedPin) {
    enterApp(selectedProfile);
  } else if (!savedPin) {
    showError("No PIN set yet on this device. Use email to sign in first.");
  } else {
    showError("Wrong PIN.");
  }
};

document.getElementById("use-email").onclick = () => {
  document.getElementById("pin-area").classList.add("hidden");
  document.getElementById("email-area").classList.remove("hidden");
};
document.getElementById("back-to-pin").onclick = () => {
  document.getElementById("email-area").classList.add("hidden");
  document.getElementById("pin-area").classList.remove("hidden");
};

document.getElementById("email-continue").onclick = () => {
  const email = document.getElementById("email-input").value.trim();
  const pw = document.getElementById("password-input").value;
  auth.signInWithEmailAndPassword(email, pw)
    .then(() => afterEmailLogin())
    .catch((e) => showError(e.message));
};
document.getElementById("email-signup").onclick = () => {
  const email = document.getElementById("email-input").value.trim();
  const pw = document.getElementById("password-input").value;
  auth.createUserWithEmailAndPassword(email, pw)
    .then(() => afterEmailLogin())
    .catch((e) => showError(e.message));
};

function afterEmailLogin() {
  if (!selectedProfile) return showError("Pick who you are first.");
  const pin = prompt("Set a 4-digit PIN for quick access on this device:");
  if (pin && /^\d{4}$/.test(pin)) {
    localStorage.setItem("pin_" + selectedProfile, pin);
  }
  enterApp(selectedProfile);
}

function showError(msg) {
  const el = document.getElementById("login-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function enterApp(person) {
  currentPerson = person;
  localStorage.setItem("lastPerson", person);
  document.getElementById("screen-login").classList.remove("active");
  document.getElementById("screen-main").classList.add("active");
  loadStateLocal();
  renderAll();
  listenToCloud();
}

document.getElementById("logout-btn").onclick = () => {
  document.getElementById("screen-main").classList.remove("active");
  document.getElementById("screen-login").classList.add("active");
  currentPerson = null;
};

// ---- TABS ----
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("view-" + btn.dataset.view).classList.add("active");
  };
});

// ---- NAMES (either person can edit either name) ----
document.querySelectorAll(".edit-name-btn").forEach(btn => {
  btn.onclick = () => {
    const target = btn.dataset.target;
    const el = document.getElementById("col-" + target + "-name");
    el.contentEditable = "true";
    el.focus();
    const onDone = () => {
      el.contentEditable = "false";
      state.names[target] = el.textContent.trim() || state.names[target];
      commit();
      el.removeEventListener("blur", onDone);
    };
    el.addEventListener("blur", onDone);
  };
});

// ---- ENTRIES ----
document.getElementById("add-entry-btn").onclick = () => {
  document.getElementById("composer-modal").classList.remove("hidden");
  document.getElementById("composer-text").value = "";
  pendingPhotos = [];
  renderComposerPhotos();
};
document.getElementById("composer-close").onclick = () => {
  document.getElementById("composer-modal").classList.add("hidden");
};
document.getElementById("composer-photo-input").onchange = (e) => {
  const files = Array.from(e.target.files);
  let remaining = files.length;
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = () => {
      pendingPhotos.push(reader.result);
      renderComposerPhotos();
    };
    reader.readAsDataURL(f);
  });
};
function renderComposerPhotos() {
  const row = document.getElementById("composer-photos");
  row.querySelectorAll(".photo-thumb").forEach(el => el.remove());
  pendingPhotos.forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.className = "photo-thumb";
    row.appendChild(img);
  });
}
document.getElementById("composer-save").onclick = () => {
  const text = document.getElementById("composer-text").value.trim();
  if (!text && pendingPhotos.length === 0) return;
  state.entries.unshift({
    id: Date.now().toString(),
    author: currentPerson,
    text,
    photos: pendingPhotos,
    time: new Date().toISOString()
  });
  document.getElementById("composer-modal").classList.add("hidden");
  commit();
};

function renderAll() {
  renderNames();
  renderEntries();
  renderTriviaScore();
  renderEndlessHigh();
}
function renderNames() {
  document.getElementById("col-me-name").textContent = state.names.me;
  document.getElementById("col-her-name").textContent = state.names.her;
  document.getElementById("label-me").textContent = state.names.me;
  document.getElementById("label-her").textContent = state.names.her;
  document.getElementById("avatar-me-letter").textContent = state.names.me[0] || "M";
  document.getElementById("avatar-her-letter").textContent = state.names.her[0] || "H";
  document.getElementById("col-me-letter").textContent = state.names.me[0] || "M";
  document.getElementById("col-her-letter").textContent = state.names.her[0] || "H";
}
function renderEntries() {
  const meCol = document.getElementById("entries-me");
  const herCol = document.getElementById("entries-her");
  meCol.innerHTML = "";
  herCol.innerHTML = "";
  state.entries.forEach(entry => {
    const card = document.createElement("div");
    card.className = "entry-card";
    let photosHtml = "";
    if (entry.photos && entry.photos.length) {
      photosHtml = '<div class="entry-photos">' + entry.photos.map(p => `<img src="${p}">`).join("") + "</div>";
    }
    const time = new Date(entry.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    card.innerHTML = photosHtml + (entry.text ? `<p class="entry-text"></p>` : "") + `<p class="entry-time">${time}</p>`;
    if (entry.text) card.querySelector(".entry-text").textContent = entry.text;
    (entry.author === "me" ? meCol : herCol).appendChild(card);
  });
}

// ---- TRIVIA ----
document.getElementById("manage-questions-btn").onclick = () => {
  document.getElementById("questions-modal").classList.remove("hidden");
  renderQuestionsList();
};
document.getElementById("questions-close").onclick = () => {
  document.getElementById("questions-modal").classList.add("hidden");
};
document.getElementById("add-question-btn").onclick = () => {
  const q = document.getElementById("new-q-text").value.trim();
  const correct = document.getElementById("new-q-answer").value.trim();
  const w1 = document.getElementById("new-q-wrong1").value.trim();
  const w2 = document.getElementById("new-q-wrong2").value.trim();
  if (!q || !correct || !w1 || !w2) return;
  state.triviaQuestions.push({ q, correct, wrong: [w1, w2] });
  ["new-q-text", "new-q-answer", "new-q-wrong1", "new-q-wrong2"].forEach(id => document.getElementById(id).value = "");
  commit();
  renderQuestionsList();
};
function renderQuestionsList() {
  const list = document.getElementById("questions-list");
  list.innerHTML = "";
  state.triviaQuestions.forEach((item, i) => {
    const row = document.createElement("div");
    row.className = "q-row";
    row.innerHTML = `<span></span><button>Remove</button>`;
    row.querySelector("span").textContent = item.q;
    row.querySelector("button").onclick = () => {
      state.triviaQuestions.splice(i, 1);
      commit();
      renderQuestionsList();
    };
    list.appendChild(row);
  });
}
let currentTrivia = null;
function newTriviaQuestion() {
  if (!state.triviaQuestions.length) {
    document.getElementById("trivia-question").textContent = "Add some questions first (Manage questions).";
    document.getElementById("trivia-options").innerHTML = "";
    return;
  }
  const item = state.triviaQuestions[Math.floor(Math.random() * state.triviaQuestions.length)];
  currentTrivia = item;
  document.getElementById("trivia-question").textContent = item.q;
  const options = [item.correct, ...item.wrong].sort(() => Math.random() - 0.5);
  const area = document.getElementById("trivia-options");
  area.innerHTML = "";
  options.forEach(opt => {
    const b = document.createElement("button");
    b.textContent = opt;
    b.onclick = () => {
      const isCorrect = opt === currentTrivia.correct;
      b.classList.add(isCorrect ? "correct" : "wrong");
      if (isCorrect) {
        state.triviaScores[currentPerson] = (state.triviaScores[currentPerson] || 0) + 1;
        commit();
      }
      setTimeout(newTriviaQuestion, 900);
    };
    area.appendChild(b);
  });
}
function renderTriviaScore() {
  document.getElementById("trivia-score").textContent =
    `${state.names.me}: ${state.triviaScores.me || 0}   ${state.names.her}: ${state.triviaScores.her || 0}`;
  if (!currentTrivia) newTriviaQuestion();
}

// ---- ENDLESS TAP GAME ----
let endlessScore = 0;
let endlessTimer = null;
document.getElementById("endless-start").onclick = () => {
  endlessScore = 0;
  document.getElementById("endless-score").textContent = "Score: 0";
  clearInterval(endlessTimer);
  moveTarget();
  endlessTimer = setInterval(moveTarget, 1100);
  setTimeout(endGame, 20000);
};
function moveTarget() {
  const arena = document.getElementById("endless-arena");
  const target = document.getElementById("endless-target");
  const maxX = arena.clientWidth - 56;
  const maxY = arena.clientHeight - 56;
  target.style.left = Math.max(0, Math.random() * maxX) + "px";
  target.style.top = Math.max(0, Math.random() * maxY) + "px";
}
document.getElementById("endless-target").onclick = () => {
  endlessScore++;
  document.getElementById("endless-score").textContent = "Score: " + endlessScore;
  moveTarget();
};
function endGame() {
  clearInterval(endlessTimer);
  if (!state.endlessHigh[currentPerson] || endlessScore > state.endlessHigh[currentPerson]) {
    state.endlessHigh[currentPerson] = endlessScore;
    commit();
  }
}
function renderEndlessHigh() {
  document.getElementById("endless-high-me").textContent = state.endlessHigh.me || 0;
  document.getElementById("endless-high-her").textContent = state.endlessHigh.her || 0;
}

// ---- Resume last session if PIN already unlocked recently (optional convenience) ----
loadStateLocal();
