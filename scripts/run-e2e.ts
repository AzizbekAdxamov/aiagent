import 'dotenv/config';
import { providerManager } from '@/ai-agent/provider-manager';

(async function run() {
  const sessionContext: any = { currentTopicName: undefined };
  const conversationHistory: any[] = [];

  async function step(user: string) {
    console.log('\n> User:', user);
    const res = await providerManager.generateResponse(user, sessionContext, conversationHistory, 'uz');
    console.log('\n< Assistant:', res.content.substring(0, 1000));
    conversationHistory.push({ role: 'user', content: user });
    conversationHistory.push({ role: 'assistant', content: res.content });
    // try to extract topicName if assistant suggested any
    const match = res.content.match(/## › ([^\n]+)/) || res.content.match(/## › ([^\n]+)/);
    if (match) sessionContext.currentTopicName = match[1];
    return res;
  }

  try {
    await step('Salom');
    await step("Menga xususiy universitetlar kerak");
    await step('Toshkent');
    await step('IT');
  } catch (e) {
    console.error('E2E failed:', e);
  }
})();
