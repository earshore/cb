// 测试所有模型
const WORKER_URL = 'https://codebuddy-worker.iclaw.workers.dev';
const API_KEY = 'sk-U8FtQmChp-api-key';

const models = [
  'Default',
  'GLM-5.0',
  'Kimi-K2.5',
  'GPT-5.4',
  'GPT-5.3-Codex',
  'GPT-5.2-Codex',
  'GPT-5.2',
  'GPT-5.1',
  'GPT-5.1-Codex-Max',
  'Gemini-3.0-Pro',
  'Gemini-3.0-Flash',
  'DeepSeek-V3.2',
  'auto-chat'
];

async function testModel(model) {
  console.log(`\n测试模型: ${model}`);

  try {
    const response = await fetch(`${WORKER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: '你好，请回复"测试成功"' }],
        max_tokens: 50
      })
    });

    console.log(`状态码: ${response.status}`);

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '无内容';
      console.log(`✓ 成功 - 响应: ${content.substring(0, 50)}`);
      return { model, success: true, content };
    } else {
      const errorText = await response.text();
      console.log(`✗ 失败 - ${errorText.substring(0, 100)}`);
      return { model, success: false, error: errorText };
    }
  } catch (error) {
    console.log(`✗ 异常 - ${error.message}`);
    return { model, success: false, error: error.message };
  }
}

async function runTests() {
  console.log('开始测试所有模型...\n');

  const results = [];

  for (const model of models) {
    const result = await testModel(model);
    results.push(result);
    // 等待 2 秒避免请求过快
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n\n========== 测试总结 ==========');
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n成功: ${successful.length}/${models.length}`);
  successful.forEach(r => console.log(`  ✓ ${r.model}`));

  console.log(`\n失败: ${failed.length}/${models.length}`);
  failed.forEach(r => console.log(`  ✗ ${r.model}: ${r.error?.substring(0, 50)}`));
}

runTests();
