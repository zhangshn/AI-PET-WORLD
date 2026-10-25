'use client'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { DocumentBody } from './document-types'
import { documentHeadings, safeDocumentHref } from './document-links'
import styles from './documents.module.css'

export function DocumentContent({document,links,anchor}:{document:DocumentBody;links:{documentId:string;relativePath:string}[];anchor?:string}){
 const headings=documentHeadings(document.content),heading=(level:number)=>function DocumentHeading(props:React.HTMLAttributes<HTMLHeadingElement>&{node?:{position?:{start:{line:number}}}}){const {node,children}=props,Tag=`h${level}` as 'h1';return <Tag id={'section-'+node?.position?.start.line}>{children}</Tag>}
 const target=headings.find(h=>h.slug===anchor||h.id===anchor)
 return <div className={styles.reading}><aside className={styles.toc} aria-label="文档章节"><h3>本篇章节</h3>{target&&<a href={'#'+target.id}>转到指定章节：{target.title}</a>}{headings.map(h=><a key={h.id} href={'#'+h.id}>{h.title}</a>)}</aside><article className={styles.markdown} aria-label="文档正文"><Markdown skipHtml remarkPlugins={[remarkGfm]} urlTransform={url=>safeDocumentHref(url,document.relativePath,links,document.content)??''} components={{h1:heading(1),h2:heading(2),h3:heading(3),h4:heading(4),h5:heading(5),h6:heading(6),a:({href,children})=>href?<a href={href}>{children}</a>:<span>{children}</span>,img:({alt})=><span>〔图片未加载：{alt??'未提供说明'}〕</span>}}>{document.content}</Markdown></article></div>
}
