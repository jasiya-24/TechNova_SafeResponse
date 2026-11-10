# 🛡️ SafeResponse

> **A real-time Emergency Response & Disaster Management Platform that lets citizens report incidents, automatically prioritises them, and helps administrators dispatch the nearest suitable response team.**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![HTML5](https://img.shields.io/badge/HTML5-single%20file-E34F26.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-F7DF1E.svg)
![Realtime](https://img.shields.io/badge/sync-BroadcastChannel%20%7C%20Firebase-orange.svg)
![Hackathon](https://img.shields.io/badge/CODE%20CLASH-2026-red.svg)
![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)

---

## 📌 Problem Statement

During road accidents, fires, floods and other disasters, emergency reports arrive from many sources at once. This creates three problems:

1. **Scattered information:** Reports come through calls, messages and walk-ins, so no single view of ongoing incidents exists.
2. **Hard to prioritise:** Without a consistent rule, a minor incident can be handled before a mass-casualty one, and waiting incidents are forgotten.
3. **Slow, manual dispatch:** Coordinators must guess which team is nearest and free, which costs minutes when minutes matter.

**SafeResponse** solves this with one centralised platform. Citizens submit a structured report, the system classifies its category and severity automatically, ranks all open incidents in a Priority Queue, and recommends the nearest available team by calculated distance. Administrators see everything live on a dashboard and a map.

---

## 🚀 Features

| Feature | Round | Mechanism | Output | Status |
|---|---|---|---|---|
| **Emergency Incident Reporting** | 1 | Validated form: title, description, category, location, people affected, optional contact | Stored report with unique ID (`SR-2026-XXXX`) and timestamp | **Working** |
| **Emergency Categories** | 1 | 6 categories with emojis: 🚒 Fire, 🚗💥 Road Accident, 🚑 Medical, 🌊 Flood, 🏚️ Building Collapse, ⚠️ Other | Category-aware triage and team matching | **Working** |
| **Severity Classification** | 1 | Transparent rule-based score from category, people affected and urgent keywords | 🟢 Low / 🟡 Medium / 🟠 High / 🔴 Critical with an "Automated Triage Note" explaining why | **Working** |
| **Emergency Dashboard** | 1 | Live counters and charts | Total, Critical, Pending, Resolved, Incidents by Category | **Working** |
| **Incident Management** | 1 | Admin list with search and filters | View, open details, update status, delete | **Working** |
| **Report Tracking** | 1 | Lookup by incident ID | Status, assigned team, ETA and timeline | **Working** |
| **Intelligent Prioritisation** | 2 | Priority score 0-100 from severity, people affected, waiting time and category | Ranked Priority Queue with a visible score breakdown | **Working** |
| **Response Team Management** | 2 | Team name/ID, type (Fire, Medical, Rescue, Police), location, availability | Add, delete and toggle teams | **Working** |
| **Location-Based Assignment** | 2 | Haversine distance between incident and team coordinates | Top 3 recommended teams with distance, ETA, match score; **Auto-assign best** | **Working** |
| **Assignment & Lifecycle Tracking** | 2 | Reported → Assigned → In Progress → Resolved with team Busy/Available sync | Per-incident timeline log | **Working** |
| **Map & Route Visualisation** | 2 | SVG map with severity-coloured markers and route lines | Distance labels and animated team movement toward the incident | **Working** |
| **Advanced Analytics** | 2 | Aggregated statistics | Available/Busy teams, average response time, team availability donut, unassigned-Critical alert banner | **Working** |
| **Pastel Themes** | UI | CSS variable theming | Mint, Lavender, Peach, Sky, Dark (choice is remembered) | **Working** |
| **Real-Time Sync** | Extra | `BroadcastChannel` + `storage` events (Firebase-ready) | Changes in one tab or device appear instantly in another | **Working** |

---

## 🏗️ Tech Stack

| Component | Role | Rationale |
|---|---|---|
| **HTML5 / CSS3** | Structure and styling | CSS variables power the five pastel themes and the responsive layout. |
| **Vanilla JavaScript (ES6)** | Application logic | No build step, so the app runs anywhere by opening one file. |
| **SVG** | Map and charts | Resolution-independent graphics that need no external tile server. |
| **localStorage** | Persistence | Reports survive page refresh with no backend. |
| **BroadcastChannel API** | Real-time sync | Instant updates across open tabs and windows. |
| **Firebase Firestore (optional)** | Multi-device real-time | All writes go through one `save()` function, so swapping storage is a few lines. |

---

## 📂 Project Structure

```
SafeResponse/
├── index.html        # Complete application (UI, logic, data, styles)
├── README.md         # Project documentation
└── LICENSE           # MIT License
```

Inside `index.html`:

| Section | Responsibility |
|---|---|
| `triage()` | Severity classification and the explanation note |
| `prio()` | Priority score (0-100) and its breakdown |
| `dist()` / `rec()` | Haversine distance and nearest-team recommendation |
| `assign()` / `chg()` / `setSt()` | Assignment, status lifecycle, team availability sync |
| `vReport` … `vMap` | Views: Report, Track, Dashboard, Incidents, Teams, Map |
| `save()` / `sync()` | Storage layer and real-time synchronisation |

---

## ⚙️ Installation & Setup

### Prerequisites
- Any modern browser (Chrome, Edge, Firefox, Safari)
- (Optional) [Git](https://git-scm.com/) to clone the repository

### Step 1: Clone the Repository
```bash
git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
cd YOUR-REPO-NAME
```

### Step 2: Run the App
No installation or build is needed. Open `index.html` in your browser:
```bash
# macOS / Linux
open index.html
# Windows
start index.html
```
Or serve it locally:
```bash
python -m http.server 8000
# then visit http://localhost:8000
```

### Step 3: Try the Real-Time Sync
Open `index.html` in **two browser tabs**. Submit a report in one tab and watch it appear on the Dashboard of the other.

### Step 4: Verify the Full Flow
1. **Report** tab → submit a Fire Emergency with 100 people affected → it is classified 🔴 Critical.
2. **Incidents** or **Dashboard** → it ranks #1 in the Priority Queue.
3. Open it → click **Auto-assign best** → the nearest fire team turns Busy.
4. **Map** tab → watch the team move along the route.
5. Mark **Resolved** → the team becomes Available again.

---

## 🧠 How It Works

### 1. Severity Classification
`score = category base + people affected points + urgent keyword points (max +3)`

| Component | Points |
|---|---|
| Category base | Fire 3, Building Collapse 3, Medical 2, Flood 2, Road Accident 2, Other 1 |
| People affected | 3-10: +1, 11-50: +2, 50+: +3 |
| Keywords | trapped, explosion, unconscious, children, bleeding, spreading, collapsed, drowning: +1 each |

Mapping: 0-3 🟢 Low, 4-5 🟡 Medium, 6-7 🟠 High, 8+ 🔴 Critical. Any report with 100+ people, or 50+ people in a Fire or Building Collapse, is always Critical.

### 2. Priority Score (0-100)
`priority = severity points + people points + waiting points + category points`

- Severity: Low 5, Medium 15, High 25, Critical 40
- People: `round(log2(people + 1) × 4)`, max 25
- Waiting time: +1 for every 3 minutes unresolved, max 20 (so older incidents rise automatically)
- Category: Fire 15, Building Collapse 15, Medical 10, Flood 10, Road Accident 10, Other 5

### 3. Nearest-Team Assignment
1. Filter teams that are **Available** and suitable for the category (for example, Fire incidents need Fire or Rescue teams).
2. Compute the **Haversine distance** from each team to the incident coordinates.
3. Rank by distance, estimate ETA at 40 km/h, and compute a match score.
4. The admin assigns a team manually or uses **Auto-assign best**. The incident becomes *Assigned* and the team becomes *Busy*.

### 4. Lifecycle and Availability Sync
`Reported → Assigned → In Progress → Resolved`. Resolving an incident automatically sets its team back to *Available* at the incident location.

### 5. Real-Time Updates
Every change is saved through one `save()` function and broadcast to other tabs through `BroadcastChannel`, so dashboards stay current without refreshing.

---

## 📈 Scalability

- **Storage:** Replace `save()` and `sync()` with Firebase Firestore `setDoc` and `onSnapshot` for true multi-device real-time sync.
- **Routing:** The straight-line distance can be upgraded to real road routes using the free OSRM API.
- **Maps:** The built-in SVG map can be swapped for Leaflet and OpenStreetMap tiles.
- **Backend:** The logic functions are pure and can be moved to a Node.js or Python API without rewriting the rules.

---

## 💡 Feasibility

- Runs from a single HTML file with zero dependencies, so it can be deployed free on GitHub Pages, Netlify or any static host.
- Works on low-end devices and over poor networks since there is no build step or heavy library.
- Rules are transparent and explainable, so administrators can understand and trust every suggestion.

---

## 🌟 Novelty & Comparative Analysis

| Capability | SafeResponse | Phone/WhatsApp coordination | Basic complaint form |
|---|---|---|---|
| Automatic severity classification | ✅ Rule-based with explanation | ❌ Manual judgement | ❌ None |
| Priority ranking that escalates with waiting time | ✅ | ❌ | ❌ |
| Nearest suitable team recommendation | ✅ Distance + ETA + match score | ❌ | ❌ |
| One-click auto-assignment | ✅ | ❌ | ❌ |
| Live map with route and moving team | ✅ | ❌ | ❌ |
| Real-time multi-tab sync | ✅ | ⚠️ Scattered chats | ❌ |
| Citizen report tracking by ID | ✅ | ❌ | ⚠️ Limited |

**Core innovation:** an *explainable* triage-to-dispatch loop. Every severity and priority decision shows the factors that produced it, and the system closes the loop by recommending, assigning and tracking the response team.

---

## 🔧 Feature Depth & Edge-Case Engineering

- **Validation:** Required fields are checked, and the number of people must be at least 1.
- **Double-assignment protection:** A Busy team cannot be assigned to another incident.
- **Safe deletion:** Deleting an incident confirms first and frees its assigned team.
- **Team protection:** A team with an active assignment cannot be deleted or toggled.
- **Escalation alert:** A red banner appears when a Critical incident stays unassigned for more than 5 minutes.
- **Input safety:** All user-entered text is HTML-escaped before display.
- **No suitable team:** The UI explains when no available team matches the category.

### Incident Data Schema
```json
{
  "id": "SR-2026-4821",
  "title": "Warehouse fire spreading",
  "cat": "Fire Emergency",
  "desc": "Large fire, people trapped on second floor",
  "loc": "Tirupati Railway Station",
  "lat": 13.6285,
  "lng": 79.4192,
  "people": 100,
  "contact": "",
  "sev": "Critical",
  "status": "Assigned",
  "team": "T-1",
  "eta": 4,
  "at": 1794300000000,
  "log": [{ "s": "Reported", "at": 1794300000000 }]
}
```

---

## ⚠️ Ethical Use & Operational Disclaimer

SafeResponse is a **demonstration platform** built for a hackathon. It does **not** contact or dispatch official emergency responders.

- **In a real emergency in India, dial 112 immediately.**
- Severity and priority values are **automated suggestions**, not confirmed emergency assessments.
- All dispatch decisions must be verified by trained human coordinators.
- Demo location coordinates and team data are sample data only.

---

## 📜 License

Licensed under the **MIT License**.

```
Copyright 2026 SafeResponse Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files, to deal in the Software
without restriction, including without limitation the rights to use, copy,
modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.
```

---

## 🧩 Author & Team

**Team SafeResponse, CODE CLASH 2026**
- **Team Lead:** YOUR NAME (your-email@example.com)
- **Member:** TEAMMATE NAME
- **Member:** TEAMMATE NAME
- **Project Repository:** https://github.com/YOUR-USERNAME/YOUR-REPO-NAME
- **Live Demo:** https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
