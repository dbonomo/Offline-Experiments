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
1. **Detect** — A node appears on the mesh many hops away — you see a silhouette
2. **Encounter** — You get closer (fewer hops, stronger signal) — details start filling in
3. **Capture** — Direct RF contact (0-1 hops, strong SNR) — full collection entry unlocked
4. **Catalog** — Progress bars show how many of the 127 hardware models, 12 roles,
   22 regions, 50 sensor types you've fully captured
5. **Share** — Export your collection as JSON to load into a community website

### Encounter Tiers (Proximity-Based)

| Tier | Criteria | What You See |
|---|---|---|
| **Shadow** | 3+ hops away, or weak signal (SNR < 0) | Silhouette only — you know the hw_model and node_id exist |
| **Spotted** | 2 hops, or moderate signal (SNR 0-5) | Model name, short_name, role revealed |
| **Encountered** | 1 hop, decent signal (SNR 5-10) | Full details visible — long_name, sensors, region, battery |
| **Captured** | Direct (0 hops), strong signal (SNR > 10) | Fully collected — gold card, all stats, locked into MeshDex |

A node can **level up** over time. First you see a TBEAM shadow 4 hops away. Weeks
later you're at a meetup and there it is, direct RF, strong signal — captured! The
progression from shadow to captured tells a story about your mesh exploring.

**RF Only:** MQTT encounters (`via_mqtt=true`) are filtered out entirely. The whole
point is getting out there with a radio. If a node is only reachable via internet
gateway, it doesn't count.

### Rarity: Community-Driven

Rarity tiers are **not hardcoded**. Instead, rarity is calculated dynamically from
aggregated community data once the website has enough uploads:

- **Rarity Score** = 1 / (% of MeshDex users who have captured this model)
- A model that 80% of users have → Common
- A model that 5% of users have → Rare
- A model that < 1% of users have → Ultra Rare

Until enough community data exists, the app shows no rarity labels — just your
collection progress. Rarity emerges organically from real-world data.

### Privacy: Signal-Based, Not Location-Based

We store **no GPS coordinates** of other people's nodes. Instead, proximity is
represented entirely through radio metrics:

- **SNR** (signal-to-noise ratio) — how clean the signal was
- **RSSI** (received signal strength) — how strong the signal was
- **Hops away** — how many nodes relayed the packet
- **Encounter tier** — derived from the above

This gives you a meaningful sense of "how close was I" without revealing anyone's
location. Your own position is never stored either unless you explicitly opt in for
personal encounter mapping.

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

**Rarity tiers** (suggested):
- **Common**: HELTEC_V3, RAK4631, TBEAM, TLORA_V2_1_1P6
- **Uncommon**: T_ECHO, WIRELESS_TRACKER, STATION_G2
- **Rare**: T_DECK, SENSECAP_INDICATOR, NANO_G2_ULTRA
- **Ultra Rare**: WIPHONE, CHATTER_2, PRIVATE_HW, ANDROID_SIM, legacy devices

### Secondary Collectibles

| Dimension | Values | Source |
|---|---|---|
| Device Role | 12 (CLIENT, ROUTER, REPEATER, TRACKER, SENSOR, TAK, etc.) | `Config.DeviceConfig.Role` |
| Region | 22 (US, EU_868, JP, ANZ, LORA_24, etc.) | `Config.LoRaConfig.RegionCode` |
| Modem Preset | 9 (SHORT_TURBO → VERY_LONG_SLOW) | `Config.LoRaConfig.ModemPreset` |
| Telemetry Sensors | 50 types (BME280, INA260, RADSENS, etc.) | `TelemetrySensorType` |
| Licensed Ham Operator | boolean `is_licensed` flag | `User` |

### Per-Encounter Metrics (not collectibles, but fun stats)
- SNR, RSSI (signal quality)
- Hop count
- GPS position (first seen location, farthest distance)
- Battery level, uptime
- Via MQTT or direct RF
- Timestamp of first/last encounter

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
├── long_name (string, nullable — revealed at Spotted tier)
├── short_name (string, nullable — revealed at Spotted tier)
├── hw_model (int — HardwareModel enum)
├── hw_model_name (string — human-readable)
├── role (int, nullable — revealed at Spotted tier)
├── is_licensed (boolean, nullable — revealed at Encountered tier)
├── region (int, nullable — revealed at Encountered tier)
├── modem_preset (int, nullable — revealed at Encountered tier)
├── tier (enum — SHADOW / SPOTTED / ENCOUNTERED / CAPTURED)
├── best_snr (float — best signal ever recorded)
├── best_rssi (int — best RSSI ever recorded)
├── min_hops (int — fewest hops ever recorded)
├── first_seen (timestamp)
├── last_seen (timestamp)
├── encounter_count (int)
├── captured_at (timestamp, nullable — when tier reached CAPTURED)

sightings (one row per RF reception — the history log)
├── id (PK, auto)
├── node_num (FK → nodes)
├── snr (float)
├── rssi (int)
├── hops_away (int)
├── tier_at_sighting (enum — what tier this sighting qualified for)
├── timestamp (long)

collection_progress (tracks "dex completion" per category)
├── category (string — "hw_model", "role", "region", etc.)
├── value (int — enum value)
├── value_name (string)
├── first_captured_at (timestamp — when first CAPTURED at this value)
├── first_captured_node (int — FK, which node)
├── unlocked (boolean)
```

**Key design choices:**
- `nodes` table only upgrades — tier goes up, never down. Best signal stats are
  high-water marks.
- `sightings` table is append-only — every RF reception is logged for stats/history.
- MQTT packets (`via_mqtt=true`) are **dropped before insertion** — never stored.
- No GPS coordinates stored for other nodes. No location data at all unless the user
  opts into storing their own position for personal encounter mapping.

---

## App Screens

### 1. MeshDex (Main Screen)
Grid/list of all 127 hardware models shown as cards. Discovered ones are full color
with details; undiscovered ones are silhouettes/greyed out. Progress bar at top:
"12/127 Models Discovered"

### 2. Node Detail
Tap a discovered model to see:
- All encounters with that model type
- First/last seen dates
- Best signal (highest SNR)
- Map pins of encounter locations
- Farthest distance encountered

### 3. Live Radar
Real-time view of currently visible nodes from the mesh, highlighting any NEW
(never-before-seen) models with a special animation/glow

### 4. Collection Stats
- Progress rings for each category (Models, Roles, Regions, Sensors)
- Recent discoveries timeline
- "Achievements" (first node, 10th model, first ham operator, first MQTT node, etc.)

### 5. Export/Import
- Export full encounter history as JSON
- Import from file (merge with existing)
- Future: upload to community website

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

### Phase 1: Proof of Concept (This Sprint)
- [ ] Android project scaffolding (Compose, Room, Meshtastic AIDL deps)
- [ ] Service binding to Meshtastic app
- [ ] Read and display current NodeDB
- [ ] Room database for encounter persistence
- [ ] Basic MeshDex grid showing discovered vs undiscovered models

### Phase 2: Game Layer
- [ ] Rarity tiers and visual treatment
- [ ] Achievement system
- [ ] Encounter detail screens with stats
- [ ] Progress rings for all collection categories

### Phase 3: Location & History
- [ ] GPS integration for encounter positions
- [ ] "Where I first saw this" map
- [ ] Distance calculations
- [ ] Timeline view of discoveries

### Phase 4: Community
- [ ] JSON export/import
- [ ] Community website (static, client-side)
- [ ] Leaderboard
- [ ] Global rarity calculations

---

## Design Decisions (Resolved)

1. **RF Only** — MQTT encounters are dropped entirely. The game is about radio.
2. **Community-Driven Rarity** — No hardcoded tiers. Rarity calculated dynamically
   from aggregated community uploads once enough data exists.
3. **Privacy First** — No GPS coordinates stored for other nodes. Proximity is
   represented through SNR, RSSI, and hop count only.
4. **Proximity Tiers** — Shadow → Spotted → Encountered → Captured progression
   based on signal quality and hop count, like leveling up a Pokémon encounter.
5. **Offline-first** — Works 100% without internet. Website sync is optional bonus.
6. **Node identity** — Track by `node_num` (stable uint32). `node_id` (`!hex` string)
   is also stable and stored, but `node_num` is the primary key.

## Open Questions

1. **Tier thresholds** — The SNR/hop cutoffs for each tier need tuning with real-world
   data. Starting values are a guess; should be configurable.
2. **Sensor detection** — Sensors aren't directly in NodeInfo; they show up when a node
   broadcasts telemetry. Do we infer sensor types from received telemetry packets?
3. **Node spoofing** — Meshtastic doesn't strongly authenticate node identity. Should
   we care about fake/spoofed nodes for a casual game? Probably not initially.
4. **Multiple devices** — If a user has two phones, can they merge MeshDex databases?
   The JSON export/import should handle this (merge by node_num, keep best tier).
