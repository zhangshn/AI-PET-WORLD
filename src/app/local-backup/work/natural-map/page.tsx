import type {Metadata} from 'next'
import Link from 'next/link'
import {NaturalMapReview} from './review'
import styles from './review.module.css'
export const metadata:Metadata={title:'当期自然地图候选审核 | AI-PET-WORLD'}
export default function NaturalMapReviewPage(){
 return <main className={styles.page}><nav><Link href="/local-backup/work#current-delivery">← 返回工作台当前交付</Link></nav>
  <header><small>项目工作台 · 本机只读审核</small><h1>当期自然地图候选</h1><p>画面由本地 Painter 生成。点选后可查看同一世界存档中的地形、通行区域、碰撞与对象。此图尚未发布到游戏。</p></header><NaturalMapReview/></main>
}
