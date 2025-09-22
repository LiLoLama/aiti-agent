declare global {
  interface WindowEventMap {
    'aiti-settings-update': CustomEvent<import('./settings').AgentSettings>;
  }
}

export {};
