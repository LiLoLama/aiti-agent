export type ChatAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  kind: 'file' | 'audio';
  durationSeconds?: number;
};

export type ChatMessage = {
  id: string;
  author: 'agent' | 'user';
  content: string;
  timestamp: string;
  attachments?: ChatAttachment[];
};

export type Chat = {
  id: string;
  name: string;
  folder?: string;
  lastUpdated: string;
  preview: string;
  messages: ChatMessage[];
};

export const sampleChats: Chat[] = [
  {
    id: '1',
    name: 'Onboarding Workflow',
    folder: 'Customer Success',
    lastUpdated: 'Heute, 09:24',
    preview: 'Ich habe den Flow angepasst und möchte wissen, ...',
    messages: [
      {
        id: 'm1',
        author: 'agent',
        content:
          'Guten Morgen! Ich habe den neuen Trigger erfolgreich aktiviert. Möchtest du die aktuellen KPIs sehen?',
        timestamp: '09:23'
      },
      {
        id: 'm2',
        author: 'user',
        content:
          'Ja bitte, zeig mir die Performance und ob es Engpässe im Datenstream gibt.',
        timestamp: '09:24'
      }
    ]
  },
  {
    id: '2',
    name: 'Marketing Automation',
    folder: 'Kampagnen',
    lastUpdated: 'Gestern, 16:02',
    preview: 'Wir wollen die Kampagne für Leads wieder aktivieren.',
    messages: [
      {
        id: 'm3',
        author: 'agent',
        content:
          'Ich habe einen Vorschlag für eine neue Multi-Step-Kampagne vorbereitet. Soll ich die Sequenz visualisieren?',
        timestamp: 'Gestern, 15:58'
      },
      {
        id: 'm4',
        author: 'user',
        content: 'Ja, gerne mit Fokus auf warme Leads aus Deutschland.',
        timestamp: 'Gestern, 16:02'
      }
    ]
  },
  {
    id: '3',
    name: 'Voice Interface Ideen',
    folder: 'F&E',
    lastUpdated: 'Dienstag, 11:17',
    preview: 'Welche Audio-Kommandos können wir unterstützen?',
    messages: [
      {
        id: 'm5',
        author: 'agent',
        content:
          'Ich habe drei neue Audio-Kommandos identifiziert, die gut zu deinem bestehenden Flow passen.',
        timestamp: 'Dienstag, 11:12'
      },
      {
        id: 'm6',
        author: 'user',
        content:
          'Perfekt. Lass uns das für einen Beta-Test vorbereiten und den Audio-Webhook dokumentieren.',
        timestamp: 'Dienstag, 11:17'
      }
    ]
  }
];

export const chatFolders = ['Alle Chats', 'Customer Success', 'Kampagnen', 'F&E'];
