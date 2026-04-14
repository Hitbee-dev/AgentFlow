import { render } from 'ink';
import React from 'react';
import { App } from './App.tsx';

export function startTUI() {
  render(React.createElement(App));
}
