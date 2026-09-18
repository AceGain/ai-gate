-- 模型分组改为必填语义：历史空分组统一归入默认分组 Default
UPDATE `sys_model` SET `category` = 'Default', `update_time` = CURRENT_TIMESTAMP WHERE `category` IS NULL OR TRIM(`category`) = '';
