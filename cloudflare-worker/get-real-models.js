// 直接调用 CodeBuddy API 获取模型列表
const CODEBUDDY_API = 'https://www.codebuddy.ai';

async function getModels() {
  // 从 KV 读取凭证
  const { execSync } = require('child_process');

  try {
    // 获取凭证列表
    const keysOutput = execSync('npx wrangler kv key list --binding=CREDENTIALS_KV --prefix=cred:', { encoding: 'utf-8' });
    const keys = JSON.parse(keysOutput);

    if (keys.length === 0) {
      console.log('没有找到凭证');
      return;
    }

    // 获取第一个凭证
    const firstKey = keys[0].name;
    const credOutput = execSync(`npx wrangler kv key get --binding=CREDENTIALS_KV "${firstKey}"`, { encoding: 'utf-8' });
    const credential = JSON.parse(credOutput);

    console.log('使用凭证:', credential.user_id);
    console.log('\n尝试获取模型列表...\n');

    // 尝试不同的端点
    const endpoints = [
      '/v2/models',
      '/v1/models',
      '/api/models',
      '/models',
      '/v2/chat/models'
    ];

    for (const endpoint of endpoints) {
      try {
        const url = `${CODEBUDDY_API}${endpoint}`;
        console.log(`尝试: ${url}`);

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${credential.bearer_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-User-Id': credential.user_id
          }
        });

        console.log(`状态: ${response.status}`);

        if (response.ok) {
          const data = await response.json();
          console.log('\n✓ 成功获取模型列表:');
          console.log(JSON.stringify(data, null, 2));
          return;
        } else {
          const errorText = await response.text();
          console.log(`错误: ${errorText.substring(0, 100)}`);
        }
      } catch (err) {
        console.log(`异常: ${err.message}`);
      }
      console.log('');
    }

    console.log('所有端点都失败了');

  } catch (error) {
    console.error('错误:', error.message);
  }
}

getModels();
