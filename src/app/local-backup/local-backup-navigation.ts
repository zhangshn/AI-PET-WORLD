export const backupPages = [
  {href:'/local-backup',label:'工作台总览',short:'总览',index:'01',description:'查看数据管理范围、来源覆盖与各项工作入口。'},
  {href:'/local-backup/inventory',label:'数据资产',short:'数据资产',index:'02',description:'查看已登记来源、分类统计、实际存储位置与清点边界。'},
  {href:'/local-backup/backups',label:'备份任务',short:'备份任务',index:'03',description:'查询备份执行、任务详情与文件清单，分别核对复制、校验和恢复状态。'},
  {href:'/local-backup/work',label:'工作记录',short:'工作记录',index:'04',description:'按日期、功能和执行窗口查阅详细工作报告、验证结果与计划对照。'},
  {href:'/local-backup/git',label:'Git版本提交',short:'Git版本提交',index:'05',description:'选择精确文件，核验预览后提交与推送，并分别查询各阶段结果。'},
] as const
