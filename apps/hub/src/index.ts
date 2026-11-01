import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

// 模板模块（t_*）业务接口统一使用 /api/temp 前缀；当前尚未注册业务路由。
app.get('/', (c) => {
  return c.text('Hello Hono!')
})

serve({
  fetch: app.fetch,
  port: 3001
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
