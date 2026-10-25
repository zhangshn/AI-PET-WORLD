'use client'
import { useEffect, useState } from 'react'
import { query, reason } from '../local-backup-shared'
export function useCatalog<T>(url:string,refresh=0){const [state,setState]=useState<{url:string;data:T|null;error:string}>({url,data:null,error:''});useEffect(()=>{let active=true;query(url).then(data=>{if(active)setState({url,data,error:''})}).catch(e=>{if(active)setState({url,data:null,error:reason(e)})});return()=>{active=false}},[url,refresh]);return state.url===url?state:{url,data:null,error:''}}
