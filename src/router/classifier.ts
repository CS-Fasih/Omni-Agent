import type { TaskType } from '../providers/types.js';
import type { Message } from '../context/types.js';
import { extractText } from '../context/token-counter.js';

export function classifyTask(message: string, contextMessages?: Message[]): TaskType {
  const text = message.toLowerCase();

  const allText = contextMessages
    ? contextMessages.map(m => extractText(m.content)).join(' ').toLowerCase()
    : '';

  if (text.includes('this file') || text.includes('entire') || text.length > 3000) {
    return 'long_context';
  }

  if (allText.length > 25000) {
    return 'long_context';
  }

  if (
    /\.(ts|js|py|go|rs|java|cpp|c|sh|rb|php|html|css|sql)\b/.test(text) ||
    /function|class|import|export|def |bug|error|fix|refactor|implement|build|create|debug|code|program/.test(
      text
    )
  ) {
    return 'coding';
  }

  if (text.length < 100 && !/\n/.test(text)) {
    return 'fast_reasoning';
  }

  if (
    text.includes('image') ||
    text.includes('screenshot') ||
    text.includes('photo') ||
    text.includes('picture')
  ) {
    return 'multimodal';
  }

  return 'general';
}
