/**
 * 对外 OpenAI 兼容 API（/v1）：面向外部调用方的模型列表查询
 */
import {Hono} from 'hono'
import {listGatewayModels} from '../store'

export const v1 = new Hono()

/** createTime（UTC "YYYY-MM-DD HH:MM:SS"）转 Unix 秒；无法解析时返回 0 */
function toUnixSeconds(createTime: string): number {
  const ms = Date.parse(`${createTime.replace(' ', 'T')}Z`)
  return Number.isNaN(ms) ? 0 : Math.floor(ms / 1000)
}

/** GET /v1/models：聚合启用供应商下启用且有效的模型，OpenAI 兼容列表结构（id 带供应商前缀） */
v1.get('/models', async (c) => {
  const rows = await listGatewayModels()
  return c.json({
    object: 'list',
    data: rows.map(row => ({
      id: `${row.providerCode}/${row.modelCode}`,
      object: 'model',
      created: toUnixSeconds(row.createTime),
      owned_by: row.providerCode
    }))
  })
})
