// Navigation wording may vary; the active, exclusive module-plan meaning may not.
export function isActiveUniqueModulePlan(text) {
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  return lines[0] === '# AI-PET-WORLD 唯一模块计划表'
    && lines.some(line => /^状态：\s*active-module-plan\s*$/.test(line))
    && lines.some(line => /^本文(?:档)?是(?:全)?项目唯一(?:模块)?计划表[，。]/.test(line))
}
