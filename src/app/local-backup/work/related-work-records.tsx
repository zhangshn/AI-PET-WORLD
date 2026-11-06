import Link from 'next/link'
import styles from './related-work-records.module.css'

const records = [
  {
    title: '512 分辨率训练输入核验',
    summary: '查看训练样本解码、输入核对结果与证据。',
    event: 'codex-dc7ffa9c46e531684b356982aeda81732c79de302f7af5a54eea5ddd11a9d5c1',
  },
  {
    title: '天气开发试验失败记录',
    summary: '查看天气程序停止的位置、预测调用次数与进程退出记录。',
    event: 'codex-2323a7454d77f4ef673e4a0bda4f1c9c3f8ac584b01a149790049f14d4030955',
  },
] as const

export function RelatedWorkRecords() {
  return <nav className={styles.records} aria-label="相关工作记录快照">
    <strong>相关工作记录快照</strong>
    <ul>{records.map(record => <li key={record.event}>
      <Link prefetch={false} href={'/local-backup/work/' + record.event}>{record.title} ↗</Link>
      <p>{record.summary}</p>
    </li>)}</ul>
  </nav>
}
