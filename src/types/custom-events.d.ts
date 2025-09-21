declare global {
  interface WindowEventMap {
    'chat-background-change': Event;
    'aiti-settings-update': CustomEvent<import('./settings').AgentSettings>;
  }
}

export {};
