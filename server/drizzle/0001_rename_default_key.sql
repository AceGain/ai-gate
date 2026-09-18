-- 历史版本新增供应商时，首个密钥名称取界面语言文案（zh-CN「默认密钥」/ en-US「Default Key」）；
-- 该名称为标识符，现固定为 default，统一修复存量数据
UPDATE `sys_key` SET `name` = 'default', `update_time` = CURRENT_TIMESTAMP WHERE `name` IN ('默认密钥', 'Default Key');
