"use client"

import {useState, useSyncExternalStore, type FormEvent} from "react"
import {useRouter} from "next/navigation"
import styles from "./natural-world-player.module.css"

type Action = "enroll" | "login" | "logout"
const subscribeToHydration = () => () => {}
const clientReady = () => true
const serverReady = () => false

export function NaturalWorldSessionForm({signedIn = false}:{signedIn?:boolean}) {
  const router=useRouter()
  const [mode,setMode]=useState<"login"|"enroll">("login")
  const [notice,setNotice]=useState("")
  const [pending,setPending]=useState(false)
  const ready=useSyncExternalStore(subscribeToHydration,clientReady,serverReady)
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(pending) return
    const form=event.currentTarget,data=new FormData(form),action:Action=signedIn?"logout":mode
    const body=signedIn ? {action} : {action,username:data.get("username"),password:data.get("password"),
      ...(action==="enroll"?{invite:data.get("invite")}:{})}
    setPending(true);setNotice("")
    try{
      const response=await fetch("/api/world/player-session",{method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})
      if(!response.ok){
        setNotice(response.status===429 ? "尝试次数过多，请稍后再试。" : action==="enroll"
          ? "未能创建账号，请核对邀请和账号要求。" : action==="logout"
            ? "退出未完成，请重试。" : "登录未成功，请检查账号与口令。")
        return
      }
      form.reset()
      if(action==="enroll"){setMode("login");setNotice("账号已建立，请登录进入首区。")}
      else router.refresh()
    }catch{setNotice("无法连接游戏服务器，请稍后重试。")}
    finally{setPending(false)}
  }
  return <form method="post" action="/api/world/player-session" onSubmit={submit} className={styles.form}>
    {!signedIn && <>
      {mode==="enroll" && <label>一次性入场邀请<input name="invite" type="password" required autoComplete="off" /></label>}
      <label>游戏账号<input name="username" required maxLength={32} autoComplete="username" spellCheck={false} /></label>
      <label>登录口令<input name="password" type="password" required minLength={mode==="enroll"?12:undefined} maxLength={128} autoComplete={mode==="enroll"?"new-password":"current-password"} /></label>
      {mode==="enroll" && <p>账号限 3 至 32 个字符，以字母或数字开头，也支持中文、下划线和短横线。口令限 12 至 128 个字符。</p>}
    </>}
    <div className={styles.actions}>
      <button type="submit" disabled={!ready||pending}>{signedIn?"退出游戏账号":mode==="enroll"?"创建账号":"登录首区"}</button>
      {!signedIn && <button type="button" className={styles.secondary} disabled={!ready||pending} onClick={()=>{
        setMode(mode==="login"?"enroll":"login");setNotice("")
      }}>{mode==="login"?"首次入场，有邀请":"已有账号，去登录"}</button>}
    </div>
    <div aria-live="polite">{notice}</div>
    <noscript>请启用 JavaScript 后登录。</noscript>
  </form>
}
