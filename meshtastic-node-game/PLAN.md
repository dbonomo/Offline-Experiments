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
1. **Discover** — Connect to your Meshtastic device, see nearby nodes
2. **Catalog** — Each new node type/model fills in your "MeshDex"
3. **Track** — Log when/where you first saw each node, signal strength, hop count
4. **Collect** — Progress bars showing how many of the 127 hardware models, 12 roles,
   22 regions, 50 sensor types you've encountered
5. **Share** — Export your collection as JSON to load into a community website

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
encounters
├── id (PK, auto)
├── node_num (uint32 — Meshtastic node number)
├── node_id (string — "!aabbccdd" format)
├── long_name (string)
├── short_name (string)
├── hw_model (int — HardwareModel enum)
├── hw_model_name (string — human-readable)
├── role (int)
├── is_licensed (boolean)
├── region (int)
├── modem_preset (int)
├── snr (float)
├── rssi (int)
├── hops_away (int)
├── via_mqtt (boolean)
├── latitude (double, nullable)
├── longitude (double, nullable)
├── altitude (int, nullable)
├── battery_level (int, nullable)
├── first_seen (timestamp)
├── last_seen (timestamp)
├── encounter_count (int)
├── my_latitude (double, nullable — YOUR position when seen)
├── my_longitude (double, nullable)

collection_progress
├── category (string — "hw_model", "role", "region", etc.)
├── value (int — enum value)
├── value_name (string)
├── first_seen (timestamp)
├── first_seen_node (string — which node first showed this)
├── unlocked (boolean)
```

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
  "exported_at": "2026-03-15T12:00:00Z",
  "owner": {
    "callsign": "KF0NZO",
    "node_id": "!aabbccdd"
  },
  "stats": {
    "total_encounters": 234,
    "unique_nodes": 87,
    "unique_models": 12,
    "unique_roles": 5,
    "unique_regions": 3
  },
  "encounters": [
    {
      "node_id": "!deadbeef",
      "long_name": "SomeNode",
      "short_name": "SN",
      "hw_model": "HELTEC_V3",
      "hw_model_id": 43,
      "role": "CLIENT",
      "is_licensed": false,
      "region": "US",
      "first_seen": "2026-02-01T14:30:00Z",
      "last_seen": "2026-03-14T09:15:00Z",
      "encounter_count": 12,
      "best_snr": 10.5,
      "best_rssi": -85,
      "min_hops": 1,
      "positions": [
        {
          "lat": 39.7392,
          "lon": -104.9903,
          "alt": 1609,
          "timestamp": "2026-02-01T14:30:00Z",
          "my_lat": 39.7400,
          "my_lon": -104.9910
        }
      ]
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

## Open Questions

1. **Rarity tiers** — Should rarity be hardcoded based on our guesses, or calculated
   dynamically from community data once the website exists?
2. **Node identity** — Nodes can change their long_name. Should we track by `node_num`
   (stable) or `node_id` (the `!hex` string, also stable)?
3. **MQTT nodes** — Nodes seen via MQTT (`via_mqtt=true`) are "easier" to collect.
   Should they count differently? (Maybe a separate "RF only" collection?)
4. **Privacy** — GPS positions of other people's nodes are sensitive. Should we only
   store approximate positions, or let users opt in?
5. **Offline-first** — The whole point is mesh/offline. The app should work 100%
   without internet. Website sync is a bonus.
