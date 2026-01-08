import { fixture, html, expect } from '@open-wc/testing';
import '../www/community/ha-atrea-recuperation-card/ha-atrea-recuperation-card.js';

describe('ha-atrea-recuperation-card', () => {
  it('is defined', async () => {
    const el = await fixture(html`<ha-atrea-recuperation-card entity_climate="climate.test"></ha-atrea-recuperation-card>`);
    expect(el).to.exist;
  });

  it('renders provided title', async () => {
    const el = await fixture(html`<ha-atrea-recuperation-card title="Test Title" entity_climate="climate.test"></ha-atrea-recuperation-card>`);
    // Wait a tick for updated() to run
    await el.updateComplete;
    const titleEl = el.shadowRoot.querySelector('.title');
    expect(titleEl).to.exist;
    expect(titleEl.textContent.trim()).to.equal('Test Title');
  });

  it('shows default target slider with configured min/max/step', async () => {
    const el = await fixture(html`<ha-atrea-recuperation-card title="Test" entity_climate="climate.test" min_temp="10" max_temp="30" temp_step="1"></ha-atrea-recuperation-card>`);
    await el.updateComplete;
    const slider = el.shadowRoot.querySelector('input[type="range"]');
    expect(slider).to.exist;
    expect(Number(slider.min)).to.equal(10);
    expect(Number(slider.max)).to.equal(30);
    expect(Number(slider.step)).to.equal(1);
  });
});
