# MeshDex - Meshtastic Node Collection Game

**Author:** KF0NZO
**Status:** Research & Planning
**Date:** 2026-03-15

---

## Concept

A "Pokédex for Meshtastic" — an Android app that turns discovering mesh nodes into a
collecting game. Every node you encounter gets logged with its hardware model, role,
sensors, region, and signal metrics. The app encourages exploring, traveling to new
areas, and encountering rare/unusual hardware.

### Core Loop
1. **Have your radio on** — just use Meshtastic like normal
2. **Collect** — every RF node you hear gets logged to your MeshDex automatically
3. **Browse** — see what hardware models, roles, and setups you've encountered
4. **Notice** — "oh cool, first WIPHONE I've ever seen" or "I keep seeing that same RAK4631"
5. **Share** — export your collection as JSON, eventually compare with the community

### Two Tiers: Heard vs Direct

Keep it simple. Two categories:

| Tier | Criteria | Meaning |
|---|---|---|
| **Heard** | 1+ hops | Your radio picked up this node relayed through the mesh |
| **Direct** | 0 hops | Your radio talked directly to this node — no relays |

Direct is the special one. It means you were close enough that your radios connected
with nothing in between. That's a real encounter. Everything else is just "heard on
the mesh" — still counts, still collected, but direct gets a little gold star.

### RF Only

MQTT encounters (`via_mqtt=true`) are **filtered out entirely**. The whole point is
getting out there with a radio. If a node is only reachable via internet gateway,
it doesn't count.

### What Makes It Fun

- **Completionism** — 127 hardware models to find, most people will only ever see 10-15
- **Rarity** — emerges from community data over time (no hardcoded tiers)
- **Stats** — best signal, most encounters, first-seen dates, how many direct contacts
- **Variety** — noting different setups, roles, regions, sensors out in the wild
- **Passive** — you don't have to hunt anyone down, just have your radio on and live life

### Privacy

- **No GPS stored** for anyone's nodes — not yours, not theirs
- Signal metrics (SNR, RSSI, hops) tell you "how good was the signal" without "where"
- The game rewards having your radio on, not tracking people down

---

## What's Collectible (Data from Meshtastic Protobufs)

### Primary Collectibles: Hardware Models (127 known)
Each node broadcasts its `HardwareModel` enum. Major families:

| Manufacturer | Count | Examples |
|---|---|---|
| LilyGO/TTGO | 24 | TBEAM, T_ECHO, T_DECK, T_WATCH_S3 |
| Heltec | 22 | HELTEC_V3, WIRELESS_TRACKER, MESH_NODE_T114 |
| RAK Wireless | 11 | RAK4631, WISMESH_TAP |
| Seeed Studio | 8 | WIO_WM1110, SENSECAP_INDICATOR |
| M5Stack | 7 | M5STACK_CORES3, CARDPUTER_ADV |
| ThinkNode | 6 | THINKNODE_M1 through M6 |
| Other/DIY | 49 | WIPHONE, CHATTER_2, ROUTASTIC, etc. |

Rarity is not hardcoded — it will be calculated from community data once enough
people are using the app. Until then, just show raw counts and let users notice
for themselves which models are common vs unusual.

### Secondary Collectibles

| Dimension | Values | Source |
|---|---|---|
| Device Role | 12 (CLIENT, ROUTER, REPEATER, TRACKER, SENSOR, TAK, etc.) | `Config.DeviceConfig.Role` |
| Region | 22 (US, EU_868, JP, ANZ, LORA_24, etc.) | `Config.LoRaConfig.RegionCode` |
| Modem Preset | 9 (SHORT_TURBO → VERY_LONG_SLOW) | `Config.LoRaConfig.ModemPreset` |
| Telemetry Sensors | 50 types (BME280, INA260, RADSENS, etc.) | `TelemetrySensorType` |
| Licensed Ham Operator | boolean `is_licensed` flag | `User` |

### Per-Node Stats (the fun stuff on each card)
- SNR, RSSI (signal quality — best ever and most recent)
- Hop count (and whether you've ever had direct contact)
- Battery level, uptime (latest known)
- Times seen (how often this node shows up)
- First seen / last seen dates

---

## Architecture Decision: AIDL Companion App (Recommended)

### Why This Approach
The fastest path is building a **companion app** that talks to the already-installed
Meshtastic Android app via its AIDL service interface. This means:

- **Zero BLE code** — the official app handles all device communication
- **No protobuf framing** — you get structured Kotlin objects
- **Proven pattern** — the ATAK Plugin already does exactly this
- **~1-2 days to first prototype**

### Alternative Approaches (for later)

| Approach | Pros | Cons | Time |
|---|---|---|---|
| **AIDL Companion** | No BLE code, fast | Requires official app installed | 1-2 days |
| **WiFi HTTP API** | Simple HTTP calls | ESP32 only, needs WiFi, binary protobuf | 2-3 days |
| **Direct BLE** | Standalone, works in field | BLE is fragile on Android, complex | 4-7 days |

---

## Tech Stack

```
Language:       Kotlin
UI:             Jetpack Compose (Material 3)
Architecture:   Single-Activity, ViewModel + StateFlow
Local DB:       Room (for encounter history — Meshtastic only stores latest state)
Data Format:    JSON export (for website upload)
Min SDK:        26 (Android 8.0)
Dependencies:
  - com.github.meshtastic:Meshtastic-Android:meshtastic-android-api
  - com.github.meshtastic:Meshtastic-Android:meshtastic-android-model
  - com.github.meshtastic:Meshtastic-Android:meshtastic-android-proto
```

---

## Data Model

### Room Database Tables

```
nodes (one row per unique node — the "card")
├── node_num (PK, uint32 — stable Meshtastic node number)
├── node_id (string — "!aabbccdd" format)
├── long_name (string)
├── short_name (string)
├── hw_model (int — HardwareModel enum)
├── hw_model_name (string — human-readable)
├── role (int)
├── is_licensed (boolean)
├── has_direct (boolean — have we ever had 0-hop contact?)
├── best_snr (float — best signal ever recorded)
├── best_rssi (int — best RSSI ever recorded)
├── min_hops (int — fewest hops ever recorded)
├── last_snr (float — most recent signal)
├── last_rssi (int)
├── last_hops (int)
├── last_battery (int, nullable)
├── first_seen (timestamp)
├── last_seen (timestamp)
├── sighting_count (int — total times seen)
├── direct_count (int — times seen at 0 hops)

sightings (one row per RF reception — the history log)
├── id (PK, auto)
├── node_num (FK → nodes)
├── snr (float)
├── rssi (int)
├── hops_away (int)
├── is_direct (boolean — 0 hops)
├── timestamp (long)
```

**Key design choices:**
- `nodes` table keeps high-water marks (best signal, lowest hops) and latest values.
- `has_direct` is the special flag — once true, never goes back. Gold star.
- `sightings` table is append-only — every RF reception logged for stats/sparklines.
- MQTT packets (`via_mqtt=true`) are **dropped before insertion** — never stored.
- No GPS coordinates stored for anyone.
- `collection_progress` table removed — we can derive dex completion from the nodes
  table with simple queries (SELECT DISTINCT hw_model, etc.).

---

## App Screens (MVP — subject to UI design iteration)

### 1. Collection (Main Screen)
Your collected nodes. Could be a grid of cards, a list, or something else — TBD
during UI design. Key info: what you've seen, how many, which are direct contacts.
Progress indicator: "Seen 42 nodes / 8 models / 3 direct"

### 2. Node Card
Tap a node to see its stats:
- Hardware model, role, name
- Signal stats (best SNR, best RSSI, hop history)
- Times seen, first/last dates
- Direct contact badge if applicable

### 3. Live Feed
Real-time view of nodes currently on the mesh. New (never-before-seen) nodes get
highlighted so you notice them.

### 4. Stats / Dex Completion
- How many of the 127 hw models you've seen
- Breakdown by role, manufacturer, etc.
- Fun stats: most-seen node, best signal ever, total sightings

### 5. Export/Import
- Export collection as JSON
- Import from file (merge by node_num, keep best stats)

**UI design is intentionally unresolved** — we want to explore the look and feel
before committing. The data layer and AIDL integration can proceed in parallel.

---

## JSON Export Format

```json
{
  "version": 1,
  "exporter": "MeshDex",
  "exported_at": "2026-04-26T12:00:00Z",
  "owner": {
    "callsign": "KF0NZO",
    "node_id": "!aabbccdd"
  },
  "stats": {
    "total_sightings": 234,
    "unique_nodes": 87,
    "captured_nodes": 42,
    "unique_models": 12,
    "unique_roles": 5,
    "unique_regions": 3
  },
  "nodes": [
    {
      "node_id": "!deadbeef",
      "long_name": "SomeNode",
      "short_name": "SN",
      "hw_model": "HELTEC_V3",
      "hw_model_id": 43,
      "role": "CLIENT",
      "is_licensed": false,
      "tier": "CAPTURED",
      "first_seen": "2026-02-01T14:30:00Z",
      "last_seen": "2026-04-25T09:15:00Z",
      "captured_at": "2026-03-10T16:45:00Z",
      "encounter_count": 12,
      "best_snr": 10.5,
      "best_rssi": -85,
      "min_hops": 0
    }
  ]
}
```

This format is self-contained, mergeable, and could feed into a community leaderboard
website.

---

## Community Website (Future — MVP Backend)

A simple static site where people upload their JSON exports:
- **Leaderboard** — who's collected the most models/nodes
- **Global MeshDex** — aggregate view of all reported hardware in the wild
- **Heatmap** — where are different models being spotted
- **Rarity index** — calculated from actual encounter data across all users

Could start as a simple GitHub Pages site with client-side JS that processes uploaded
JSON files. No server needed initially.

---

## Existing Meshtastic Ecosystem to Leverage

### Existing Tools (don't reinvent)
- **Meshtastic Map** (Liam Cottle) — already does node mapping via MQTT
- **MeshInfo** — real-time monitoring with MQTT ingestion
- **Python CLI** — `meshtastic --nodes` dumps node DB as JSON

### Data Gap We Fill
None of these existing tools focus on the **collection/gamification** angle. They're
monitoring tools. MeshDex is a game that happens to use the same data.

### Key Insight About Data Storage
Meshtastic devices only store the **latest state** of each node — no encounter history.
Our Room database is what makes the "collection" aspect possible by persisting a
time-series of encounters that the device itself doesn't keep.

---

## Phase Plan

### Phase 1: Can We Get The Data? (Now — in parallel with UI design)
- [ ] Android project scaffolding (Compose, Room, Meshtastic AIDL deps)
- [ ] Bind to Meshtastic app's AIDL service
- [ ] Read the current NodeDB — prove we can get hw_model, role, signal, hops
- [ ] Filter out MQTT nodes
- [ ] Room database: persist nodes + sightings
- [ ] Basic list showing what we've collected (placeholder UI)

### Phase 2: Make It Look Good (after UI design exploration)
- [ ] Implement the UI we design — cards, layout, colors, etc.
- [ ] Node detail screen with stats
- [ ] Live feed with "new node" highlighting
- [ ] Dex completion / stats screen

### Phase 3: Polish & Share
- [ ] JSON export/import
- [ ] Fun stats and collection milestones
- [ ] Community rarity (once we have a website to aggregate data)

### Future Ideas (not committed)
- Points for receiving replies on LongFast
- Community website / leaderboard
- Sensor type collection from telemetry packets

---

## Design Decisions (Resolved)

1. **RF Only** — MQTT encounters are dropped entirely. The game is about radio.
2. **Two tiers** — Heard (1+ hops) vs Direct (0 hops). Simple. Direct gets a gold star.
3. **Community-Driven Rarity** — No hardcoded tiers. Rarity calculated dynamically
   from community data once enough people are using the app.
4. **Privacy First** — No GPS coordinates stored for anyone. Signal metrics only.
5. **Passive collection** — The game rewards having your radio on, not hunting people.
6. **Offline-first** — Works 100% without internet. Website sync is optional bonus.
7. **Node identity** — Track by `node_num` (stable uint32) as primary key.
8. **UI is TBD** — Data layer proceeds in parallel with UI design exploration.

## Open Questions

1. **Sensor detection** — Sensors aren't directly in NodeInfo; they show up when a node
   broadcasts telemetry. Do we infer sensor types from received telemetry packets?
2. **Multiple devices** — If a user has two phones, can they merge MeshDex databases?
   JSON export/import should handle this (merge by node_num, keep best stats).
3. **What does a "node card" look like?** — UI design exploration needed.
