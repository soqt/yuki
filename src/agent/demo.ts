import dotenv from 'dotenv';
import { createAgent } from './index';

dotenv.config();

// Quick manual test of the agent core. Build the project, then:
//   node dist/src/agent/demo.js "帮我查下上海天气，适合穿什么"
// Requires ANTHROPIC_API_KEY (plus QWEATHER_KEY / JUHE_KEY for the tools).
async function main() {
  const message = process.argv.slice(2).join(' ') || '今天北京天气怎么样，适合穿什么？';
  const agent = createAgent({ webSearch: true });
  console.log('👤', message);
  const { reply } = await agent.chat({
    message,
    ctx: {
      user: {
        openid: 'demo-user',
        nickname: 'Yuki',
        city: '北京',
        constellation: '天秤座',
      },
    },
  });
  console.log('🤖', reply);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
