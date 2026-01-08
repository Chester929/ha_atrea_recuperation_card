/**
 * HA Atrea Recuperation Lovelace Custom Card (slider target control)
 *
 * HACS-packagable card file.
 *
 * Minimal external dependency: lit from unpkg. If you prefer bundling, build a dist file instead.
 *
 * Usage:
 *  - resource: /hacsfiles/ha-atrea-recuperation-card/ha-atrea-recuperation-card.js  (HACS)
 *  - or /local/community/ha-atrea-recuperation-card/ha-atrea-recuperation-card.js (manual)
 *
 * Author: Chester929
 * License: MIT
 */
import { LitElement, html, css } from "https://unpkg.com/lit@2.6.1?module";

class HaAtreaRecuperationCard extends LitElement {
    static get properties() {
        return {
            hass: { type: Object },
            config: { type: Object },
            _targetValue: { type: Number },
            _tempUnit: { type: String },
        };
    }

    constructor() {
        super();
        this.config = {};
        this._targetValue = null;
        this._tempUnit = "°C";
    }

    static get styles() {
        return css`
      :host {
        display: block;
        font-family: var(--ha-card-font-family, inherit);
      }
      .card {
        padding: 16px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      .title {
        font-weight: 600;
        font-size: 16px;
      }
      .temp {
        font-size: 28px;
        font-weight: 600;
      }
      .sensor-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      button {
        background: var(--primary-color);
        color: white;
        border: none;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
      }
      button.secondary {
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
      }
      input[type="number"] {
        width: 80px;
        padding: 6px;
      }
      input[type="range"] {
        width: 100%;
        -webkit-appearance: none;
        height: 6px;
        border-radius: 4px;
        background: linear-gradient(90deg, var(--primary-color) 0%, var(--primary-color) 50%, var(--divider-color) 50%);
        outline: none;
      }
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--paper-item-icon-color, #fff);
        border: 2px solid var(--primary-color);
        box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.05);
        cursor: pointer;
      }
      .range-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      select {
        padding: 6px;
      }
      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .small {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .target-box {
        min-width: 78px;
        text-align: center;
        padding: 6px 8px;
        border-radius: 6px;
        background: var(--secondary-background-color);
      }
      hr {
        border: none;
        height: 1px;
        background: var(--divider-color);
        margin: 8px 0;
      }
    `;
    }

    setConfig(config) {
        if (!config || !config.entity_climate) {
            throw new Error("Configuration must include an entity_climate");
        }
        this.config = {
            title: config.title || "Atrea Recuperation",
            entity_climate: config.entity_climate,
            entity_number: config.entity_number || null,
            entity_fan: config.entity_fan || null,
            entity_select: config.entity_select || null,
            sensors: config.sensors || [],
            buttons: config.buttons || [],
            temp_step: config.temp_step || 0.5,
            min_temp: config.min_temp || 5,
            max_temp: config.max_temp || 30,
            ...config,
        };
    }

    getCardSize() {
        return 4;
    }

    updated(changedProps) {
        if (changedProps.has("hass")) {
            const climateState = this._st(this.config.entity_climate);
            if (climateState && climateState.attributes) {
                if (climateState.attributes.unit_of_measurement) {
                    this._tempUnit = climateState.attributes.unit_of_measurement;
                } else {
                    this._tempUnit = "°C";
                }
            }
            if (this.config.entity_number) {
                const nst = this._st(this.config.entity_number);
                if (nst && nst.state !== "unknown") {
                    const nval = Number(nst.state);
                    if (!isNaN(nval) && this._targetValue !== nval) {
                        this._targetValue = nval;
                    }
                }
            } else if (climateState && climateState.attributes) {
                const cand = climateState.attributes.temperature ?? climateState.attributes.target_temperature ?? climateState.attributes.current_temperature;
                if (cand !== undefined && cand !== null) {
                    const cval = Number(cand);
                    if (!isNaN(cval) && this._targetValue !== cval) {
                        this._targetValue = cval;
                    }
                }
            }
        }
    }

    _st(entityId) {
        return this.hass && this.hass.states ? this.hass.states[entityId] : undefined;
    }

    _onSliderInput(e) {
        const v = Number(e.target.value);
        if (!isNaN(v)) {
            this._targetValue = v;
        }
        this._updateSliderBackground(e.target);
    }

    async _onSliderChange(e) {
        const v = Number(e.target.value);
        if (isNaN(v)) return;
        await this._setTarget(v);
    }

    _updateSliderBackground(slider) {
        try {
            const min = Number(slider.min);
            const max = Number(slider.max);
            const val = Number(slider.value);
            const pct = ((val - min) / (max - min)) * 100;
            slider.style.background = `linear-gradient(90deg, var(--primary-color) ${pct}%, var(--divider-color) ${pct}%)`;
        } catch (err) {
            // ignore
        }
    }

    async _setTarget(value) {
        if (value < this.config.min_temp) value = this.config.min_temp;
        if (value > this.config.max_temp) value = this.config.max_temp;
        this._targetValue = value;
        if (this.config.entity_number) {
            await this.hass.callService("number", "set_value", {
                entity_id: this.config.entity_number,
                value: Number(value),
            });
        } else {
            await this.hass.callService("climate", "set_temperature", {
                entity_id: this.config.entity_climate,
                temperature: Number(value),
            });
        }
    }

    async _setHvacMode(e) {
        const mode = e.target.value;
        if (this.config.entity_select) {
            await this.hass.callService("select", "select_option", {
                entity_id: this.config.entity_select,
                option: mode,
            });
        } else {
            await this.hass.callService("climate", "set_hvac_mode", {
                entity_id: this.config.entity_climate,
                hvac_mode: mode,
            });
        }
    }

    async _setFanPercentage(e) {
        const val = Number(e.target.value);
        if (!this.config.entity_fan) return;
        await this.hass.callService("fan", "set_percentage", {
            entity_id: this.config.entity_fan,
            percentage: val,
        });
    }

    async _pressButton(entityId) {
        await this.hass.callService("button", "press", { entity_id: entityId });
    }

    _renderSensors() {
        if (!this.config.sensors || this.config.sensors.length === 0) return html``;
        return html`
      <div class="title small">Sensors</div>
      <div class="sensor-list">
        ${this.config.sensors.map(
            (e) => {
                const st = this._st(e);
                const name = (st && st.attributes && st.attributes.friendly_name) || e;
                const val = st ? st.state : "unknown";
                const unit = st && st.attributes ? st.attributes.unit_of_measurement || "" : "";
                return html`<div class="row"><div class="small">${name}</div><div class="small" style="margin-left:auto">${val} ${unit}</div></div>`;
            }
        )}
      </div>
    `;
    }

    _renderButtons() {
        if (!this.config.buttons || this.config.buttons.length === 0) return html``;
        return html`
      <div class="title small">Actions</div>
      <div class="actions">
        ${this.config.buttons.map((b) => {
            const st = this._st(b);
            const name = (st && st.attributes && st.attributes.friendly_name) || b;
            return html`<button class="secondary" @click=${() => this._pressButton(b)}>${name}</button>`;
        })}
      </div>
    `;
    }

    _renderModeControl() {
        if (this.config.entity_select) {
            const st = this._st(this.config.entity_select);
            const options = st && st.attributes && st.attributes.options ? st.attributes.options : [];
            const current = st ? st.state : "";
            return html`
        <div class="row">
          <div class="small">Mode</div>
          <select @change="${this._setHvacMode}" .value="${current}" style="margin-left:auto">
            ${options.map((o) => html`<option .value="${o}">${o}</option>`)}
          </select>
        </div>
      `;
        } else {
            const st = this._st(this.config.entity_climate);
            const options = st && st.attributes && st.attributes.hvac_modes ? st.attributes.hvac_modes : [];
            const current = st && st.state ? st.state : "";
            if (!options || options.length === 0) return html``;
            return html`
        <div class="row">
          <div class="small">Mode</div>
          <select @change="${this._setHvacMode}" .value="${current}" style="margin-left:auto">
            ${options.map((o) => html`<option .value="${o}">${o}</option>`)}
          </select>
        </div>
      `;
        }
    }

    _renderFanControl() {
        if (!this.config.entity_fan) return html``;
        const st = this._st(this.config.entity_fan);
        const val = st && st.state !== "unknown" ? Number(st.state) : 0;
        return html`
      <div class="row">
        <div class="small">Fan</div>
        <input type="range" min="0" max="100" .value="${val}" @change="${this._setFanPercentage}" style="flex:1" />
        <div class="small" style="width:40px;text-align:right">${val}%</div>
      </div>
    `;
    }

    render() {
        const climateState = this._st(this.config.entity_climate);
        const currentTemp = climateState && climateState.attributes ? climateState.attributes.current_temperature ?? climateState.attributes.temperature ?? null : null;
        const displayCurrent = currentTemp !== undefined && currentTemp !== null ? currentTemp : (climateState ? climateState.state : "unknown");

        let target = this._targetValue;
        if ((target === null || target === undefined) && this.config.entity_number) {
            const nst = this._st(this.config.entity_number);
            if (nst) target = Number(nst.state);
        }
        if ((target === null || target === undefined) && climateState && climateState.attributes) {
            target = climateState.attributes.temperature ?? climateState.attributes.target_temperature ?? climateState.attributes.current_temperature;
        }

        const min = this.config.min_temp;
        const max = this.config.max_temp;
        const step = this.config.temp_step;

        return html`
      <ha-card class="card">
        <div class="row">
          <div class="title">${this.config.title}</div>
          <div style="margin-left:auto" class="small">Status: ${climateState ? climateState.state : "unknown"}</div>
        </div>

        <div class="row">
          <div>
            <div class="small">Current</div>
            <div class="temp">${displayCurrent !== null ? displayCurrent : "—"} ${this._tempUnit}</div>
          </div>

          <div style="margin-left:auto;text-align:right">
            <div class="small">Target</div>
            <div class="range-row" style="width:320px;max-width:60vw">
              <input
                id="targetSlider"
                type="range"
                min="${min}"
                max="${max}"
                step="${step}"
                .value="${target !== null && target !== undefined ? target : (min + (max - min) / 2)}"
                @input="${this._onSliderInput}"
                @change="${this._onSliderChange}"
              />
              <div class="target-box small">${target !== null && target !== undefined ? target.toFixed(step % 1 ? 1 : 0) : "—"} ${this._tempUnit}</div>
            </div>
          </div>
        </div>

        <hr />

        ${this._renderModeControl()}
        ${this._renderFanControl()}

        <hr />

        ${this._renderSensors()}

        <hr />

        ${this._renderButtons()}
      </ha-card>
    `;
    }
}

customElements.define("ha-atrea-recuperation-card", HaAtreaRecuperationCard);