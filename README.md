# HA Atrea Recuperation Lovelace Card

This repository contains a HACS‑packagable Lovelace custom card for the HA Atrea Recuperation integration.

Install via HACS (recommended)
1. In Home Assistant → HACS → Frontend → ••• → Custom repositories
    - Repository URL: `https://github.com/<your-account>/ha-atrea-recuperation-card`
    - Category: `Lovelace`
2. Install the card.
3. Add resource:
    - `/hacsfiles/ha-atrea-recuperation-card/ha-atrea-recuperation-card.js`
    - Type: module

Manual installation
1. Copy the `dist/ha-atrea-recuperation-card.js` file to `/config/www/community/ha-atrea-recuperation-card/`.
2. Add resource `/local/community/ha-atrea-recuperation-card/ha-atrea-recuperation-card.js` (type: module).

Sample Lovelace usage
```yaml
type: 'custom:ha-atrea-recuperation-card'
title: Atrea RD1
entity_climate: climate.atrea_bustehrad_rd1
entity_number: number.atrea_bustehrad_rd1_target_temperature   # optional
entity_fan: fan.atrea_bustehrad_rd1_fan                        # optional
entity_select: select.atrea_bustehrad_rd1_operation_mode       # optional
sensors:
  - sensor.atrea_bustehrad_rd1_indoor_temperature
  - sensor.atrea_bustehrad_rd1_supply_flow
buttons:
  - button.atrea_bustehrad_rd1_reset_filters
  - button.atrea_bustehrad_rd1_reset_uv
temp_step: 0.5
min_temp: 5
max_temp: 30
```

For full documentation of the integration and entity names, see your integration repository docs.