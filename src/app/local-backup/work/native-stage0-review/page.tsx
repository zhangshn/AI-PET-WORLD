import Link from 'next/link'
import {DevelopmentGallery} from './review'
export default async function NativeStage0ReviewPage({searchParams}:{searchParams:Promise<{epoch?:string}>}){
  const {epoch}=await searchParams
  return <main style={{maxWidth:1000,margin:'0 auto',padding:'1rem'}}>
    <Link href="/local-backup/work#current-delivery">← 返回当前交付</Link>
    {epoch==='12'||epoch==='24'?<DevelopmentGallery epoch={Number(epoch)}/>:<p>请选择已登记的固定验证轮次。</p>}
  </main>
}
