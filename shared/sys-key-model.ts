/**
 * 供应商-密钥-模型速查关联：sys_key_model 表的前后端共用结构
 * 注意：本文件不得引入 Nuxt/浏览器特有 API
 */

export interface SysKeyModel {
  providerId: string
  keyId: string
  modelId: string
}
