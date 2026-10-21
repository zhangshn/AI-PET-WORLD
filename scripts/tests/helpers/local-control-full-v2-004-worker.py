"""Private arithmetic CPU worker: no model library, GPU, network or downloads."""
import json,sys,time,subprocess,hashlib,os
from pathlib import Path
args=sys.argv[1:]
assert len(args)==4 and args[0]=='--cpu-request' and args[2]=='--sha256'
raw=Path(args[1]).read_bytes();assert hashlib.sha256(raw).hexdigest()==args[3]
request=json.loads(raw);case=json.loads(Path('.runtime/fixture/case.json').read_bytes())
assert case['taskId']=='M-LOCAL-FULL-V2-CPU-004'
deadline=case['deadlineUnixMs']/1000
if request['phase']=='cpu':
    first=json.loads(Path('.runtime/fixture/initiator.json').read_bytes())
    while True:
        assert time.time()<deadline-5
        command="$p=Get-CimInstance Win32_Process -Filter 'ProcessId="+str(first['pid'])+"';if($null-eq$p){'absent'}else{$p.CreationDate.ToUniversalTime().ToString('o')}"
        p=subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-Command',command],capture_output=True,text=True,timeout=5)
        assert p.returncode==0
        observed=p.stdout.strip()
        if observed=='absent' or str(first['pid'])+':'+observed!=first['identity']:break
        time.sleep(.1)
    Path(request['observationPath']).write_text(json.dumps({'initiatorExitObserved':True,'initiator':first,'observed':observed,'observerSignalRequired':False,'pid':os.getpid(),'atUnixMs':int(time.time()*1000)}))
    time.sleep(2)
else:
    time.sleep(1 if case['mode']!='stop' else 60)
values=[(n+1)**2 for n in range(128)]
print(json.dumps({'sum':sum(values),'count':len(values),'initiatorExitObserved':request['phase']=='cpu','modelForwardCalls':0}),flush=True)
sys.exit(7 if request['phase']=='execute' and case['mode']=='failure' else 0)
