// 测试不同的模型 ID 格式
const WORKER_URL = 'https://codebuddy-worker.iclaw.workers.dev';
const API_KEY = 'sk-U8FtQmChp-api-key';

// 尝试不同的模型 ID 格式
const modelVariants = {
  'GLM-5.0': ['glm-5.0', 'glm-5', 'glm5', 'GLM5', 'chatglm-5'],
  'GPT-5.4': ['gpt-5.4', 'gpt-5-4', 'gpt5.4', 'gpt54', 'GPT5.4'],
  'Kimi-K2.5': ['kimi-k2.5', 'kimi-k2', 'kimi', 'moonshot-v1'],
  'Default': ['default', 'auto', 'auto-chat'],
  'DeepSeek-V3.2': ['deepseek-v3.2', 'deepseek-v3', 'deepseek', 'deepseek-chat']
};

async function testModelVariant(modelId) {
  try {
    const response = await fetch(`${WORKER_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 5
      })
    });

    if (response.ok) {
      return { success: true, modelId };
    } else {
      const error = await response.json();
      return { success: false, modelId, error: error.details };
    }
  } catch (err) {
    return { success: false, modelId, error: err.message };
  }
}

async function findWorkingModels() {
  console.log('开始测试不同的模型 ID 格式...\n');

  for (const [displayName, variants] of Object.entries(modelVariants)) {
    console.log(`\n测试 ${displayName}:`);

    for (const variant of variants) {
      const result = await testModelVariant(variant);

      if (result.success) {
        console.log(`  ✓ ${variant} - 成功！`);
        break;
      } else {
        const errorMsg = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
        if (errorMsg.includes('not found') || errorMsg.includes('11102')) {
          console.log(`  ✗ ${variant} - 模型不存在`);
        } else {
          console.log(`  ? ${variant} - ${errorMsg.substring(0, 50)}`);
        }
      }

      // 等待避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

findWorkingModels();
