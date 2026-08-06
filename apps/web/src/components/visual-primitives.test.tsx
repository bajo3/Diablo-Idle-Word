// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';
import { Icon } from './Icon';
import { Panel } from './Panel';

describe('visual primitives', () => {
  it('renders inline SVG icons as decorative or labelled content', () => {
    const { container } = render(
      <div>
        <Icon name="sword" />
        <Icon label="Vida" name="heart" />
      </div>,
    );

    expect(screen.getByRole('img', { name: 'Vida' })).toBeTruthy();
    expect(container.querySelectorAll('svg')).toHaveLength(2);
    expect(container.querySelector('svg[aria-hidden="true"]')).toBeTruthy();
  });

  it('keeps buttons keyboard-safe and exposes variant/size hooks', () => {
    render(
      <Button icon={<Icon name="play" size={16} />} size="lg" variant="primary">
        Jugar
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Jugar' });
    expect(button.getAttribute('type')).toBe('button');
    expect(button.getAttribute('data-variant')).toBe('primary');
    expect(button.getAttribute('data-size')).toBe('lg');
    expect(button.className).toContain('ui-button');
  });

  it('associates a titled panel with its semantic heading', () => {
    render(
      <Panel eyebrow="Inventario" title="Equipo" variant="ornate">
        <p>Contenido</p>
      </Panel>,
    );

    const panel = screen.getByRole('region', { name: 'Equipo' });
    expect(panel.className).toContain('ui-panel--ornate');
    expect(screen.getByRole('heading', { name: 'Equipo' })).toBeTruthy();
  });
});
