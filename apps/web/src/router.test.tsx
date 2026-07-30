// @vitest-environment jsdom
import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type AppPath, usePath } from './router';

function Probe({ onNavigate }: { onNavigate: (navigate: (path: AppPath) => void) => void }) {
  const [path, navigate] = usePath();
  useEffect(() => onNavigate(navigate), [navigate, onNavigate]);
  return <output>{path}</output>;
}

describe('usePath', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'));
  afterEach(() => window.history.replaceState({}, '', '/'));

  it('updates from navigation and browser popstate back/forward events', async () => {
    let navigate: ((path: AppPath) => void) | undefined;
    render(
      <Probe
        onNavigate={(next) => {
          navigate = next;
        }}
      />,
    );

    navigate?.('/guardianes');
    expect(await screen.findByText('/guardianes')).toBeTruthy();
    window.history.pushState({}, '', '/estado');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByText('/estado')).toBeTruthy();
    window.history.pushState({}, '', '/guardianes');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(await screen.findByText('/guardianes')).toBeTruthy();
  });
});
