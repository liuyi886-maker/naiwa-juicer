# 奶娃榨汁机

游戏：https://naiwa-juicer.1074650058.workers.dev/

运营后台：https://naiwa-juicer.1074650058.workers.dev/admin/（需要管理员密码）

原创角色捕猎与工坊经营网页游戏。横竖屏首页、横屏游戏、五种角色、原声受击音效、生产和售卖、云端存档与独立运营后台。

本工程可独立部署到 Cloudflare Workers + D1，不依赖 ChatGPT Sites。
仓库中的图片、声音和角色资产不附带开放许可。

## 本地运行

Node.js 22.13+：

```sh
npm ci
npm run db:local
npm run dev
npm test
```

## 正式部署

1. `npx wrangler login`
2. `npx wrangler d1 create naiwa-juicer-db`，将返回的 database_id 填入 wrangler.json。默认占位 ID 只用于本地验证，不能直接当作云库。
3. `npm run db:remote`
4. 设置 `ADMIN_PASSWORD_HASH` Worker secret，值为强随机管理员密码的 SHA-256 十六进制散列。不要将密码、散列或令牌提交到仓库。
5. `npm run deploy`

实际游戏网址以部署成功返回值为准，后台为同域 `/admin/`，没有游戏内入口。
GitHub Pages 无法单独运行此项目的数据库和 API，请勿只发布 public 后宣称云存档已经工作。

## 数据

同一浏览器的匿名身份保留存档、捕猎记录；在线时长包含暂停和后台停留，重叠标签页去重。
旧域名与新域名的浏览器身份不会自动合并，换设备或清空浏览器数据不等同于账号登录恢复。
测试使用内存 SQLite 或本地 D1，不写生产数据。尚未进行万人并发压测。
