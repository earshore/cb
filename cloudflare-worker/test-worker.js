// 测试 Worker 端点
const WORKER_URL = 'https://codebuddy-worker.iclaw.workers.dev';
const API_KEY = 'sk-U8FtQmChp-api-key';

async function testEndpoint(name, url, options = {}) {
  console.log(`\n=== 测试: ${name} ===`);
  console.log(`URL: ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    console.log(`状态码: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('响应:', JSON.stringify(data, null, 2));
      } else {
        const text = await response.text();
        console.log('响应:', text.substring(0, 200));
      }
      console.log('✓ 成功');
      return true;
    } else {
      const text = await response.text();
      console.log('错误响应:', text);
      console.log('✗ 失败');
      return false;
    }
  } catch (error) {
    console.log('✗ 异常:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('开始测试 CodeBuddy Worker...\n');

  // 1. 健康检查
  await testEndpoint('健康检查', `${WORKER_URL}/health`);

  // 2. API 信息
  await testEndpoint('API 信息', `${WORKER_URL}/api`);

  // 3. 模型列表
  await testEndpoint('模型列表', `${WORKER_URL}/v1/models`);

  // 4. 聊天完成（非流式）
  await testEndpoint('聊天完成（非流式）', `${WORKER_URL}/v1/chat/completions`, {
    method: 'POST',
    body: JSON.stringify({
      model: 'auto-chat',
      messages: [
        { role: 'user', content: '你好，请回复"测试成功"' }
      ],
      max_tokens: 50
    })
  });

  console.log('\n测试完成！');
}

runTests();
