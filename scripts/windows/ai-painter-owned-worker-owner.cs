
using System;
using System.IO;
using System.IO.Pipes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Runtime.InteropServices;
public static class EndpointCpuOwnedJob {
 public static int Main(string[] a){
  try{string[] command=new string[a.Length-6];Array.Copy(a,6,command,0,command.Length);
   Result r=Run(a[0],command,a[1],long.Parse(a[2]),int.Parse(a[3]),a[4],a[5]);
   string json=new System.Web.Script.Serialization.JavaScriptSerializer().Serialize(r);
   try{Console.Out.WriteLine("R:"+B64(json));Console.Out.Flush();}catch(IOException){}
   return 0;
  }catch(Exception ex){try{Console.Error.WriteLine(ex);}catch{}return 1;}
 }

 [StructLayout(LayoutKind.Sequential)] struct Basic { public long a,b; public uint flags; public UIntPtr min,max; public uint count; public UIntPtr affinity; public uint priority,scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct Io { public ulong a,b,c,d,e,f; }
 [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic basic; public Io io; public UIntPtr pm,jm,ppm,pjm; }
 [StructLayout(LayoutKind.Sequential)] struct Accounting { public long a,b,c,d; public uint faults,total,active,terminated; }
 [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)] struct Startup { public uint cb; public string reserved,desktop,title; public uint x,y,xs,ys,xc,yc,fill,flags; public ushort show,reserved2; public IntPtr reservedPtr,input,output,error; }
 [StructLayout(LayoutKind.Sequential)] struct ProcessInfo { public IntPtr process,thread; public uint pid,tid; }
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr security,string name);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,IntPtr data,uint size);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr job,int kind,out Accounting data,uint size,IntPtr length);
 [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern bool CreateProcess(string app,StringBuilder command,IntPtr ps,IntPtr ts,bool inherit,uint flags,IntPtr environment,string directory,ref Startup startup,out ProcessInfo info);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll", SetLastError=true)] static extern uint ResumeThread(IntPtr thread);
 [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr process,out uint code);
 [DllImport("kernel32.dll")] static extern bool GetProcessTimes(IntPtr process,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll")] static extern bool TerminateProcess(IntPtr process,uint code);
 [DllImport("kernel32.dll")] static extern bool TerminateJobObject(IntPtr job,uint code);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);

 public class Result { public bool assignedBeforeResume,killOnJobClose; public uint ownerPid,rootPid,exitCode,activeProcessesAfterCleanup,totalProcesses; public string stopReason,rootCreationDateUtc,cleanupError,observationError,bindingBase64; public long stdoutBytes,stderrBytes; }
 static readonly object outputLock=new object();
 [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")] static extern uint GetCurrentProcessId();
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessAffinityMask(IntPtr process,out UIntPtr mask,out UIntPtr systemMask);
 static string B64(string v){return Convert.ToBase64String(Encoding.UTF8.GetBytes(v??""));}
 static void Publish(string target,string binding,Result r,string transportError){
  if(String.IsNullOrEmpty(target)||!r.assignedBeforeResume||r.activeProcessesAfterCleanup!=0)return;
  long creation,exit,kernel,user;Check(GetProcessTimes(GetCurrentProcess(),out creation,out exit,out kernel,out user),"owner_identity");
  string json="{\"schemaVersion\":\"ai-painter-owned-job-observation-v1\",\"authority\":\"observation_only_no_release_authority\",\"bindingBase64\":\""+binding+"\",\"ownerPid\":"+GetCurrentProcessId()+",\"ownerCreationFileTime\":\""+creation+"\",\"rootPid\":"+r.rootPid+",\"rootCreationDateUtc\":\""+r.rootCreationDateUtc+"\",\"assignedBeforeResume\":true,\"activeProcessesAfterCleanup\":0,\"totalProcesses\":"+r.totalProcesses+",\"observedAtUtc\":\""+DateTime.UtcNow.ToString("o")+"\",\"stopReasonBase64\":\""+B64(r.stopReason)+"\",\"cleanupErrorBase64\":\""+B64(r.cleanupError)+"\",\"transportErrorBase64\":\""+B64(transportError)+"\"}";
  UIntPtr mask,systemMask;Check(GetProcessAffinityMask(GetCurrentProcess(),out mask,out systemMask),"owner_affinity");
  json=json.Substring(0,json.Length-1)+",\"ownerAffinityMask\":\""+mask.ToUInt64()+"\"}";
  byte[] bytes=Encoding.UTF8.GetBytes(json);if(bytes.Length>65536)throw new Exception("observation_size_limit");
  using(var f=new FileStream(target+".pending",FileMode.CreateNew,FileAccess.Write,FileShare.None)){f.Write(bytes,0,bytes.Length);f.Flush(true);}
  File.Move(target+".pending",target);
 }

 static void Check(bool ok,string name) {if(!ok)throw new Exception(name+":"+Marshal.GetLastWin32Error());}
 static string Quote(string value) {var b=new StringBuilder("\"");int n=0;foreach(char c in value){if(c=='\\'){n++;continue;}if(c=='"'){b.Append('\\',n*2+1);b.Append(c);}else{b.Append('\\',n);b.Append(c);}n=0;}b.Append('\\',n*2);b.Append('"');return b.ToString();}
 static long Now(){return (long)(DateTime.UtcNow-new DateTime(1970,1,1,0,0,0,DateTimeKind.Utc)).TotalMilliseconds;}
 static Accounting Stats(IntPtr job){Accounting s;Check(QueryInformationJobObject(job,1,out s,(uint)Marshal.SizeOf(typeof(Accounting)),IntPtr.Zero),"query_job");return s;}
 class Capture { public long count; public Task task; public string transportError; }
 static Capture Read(AnonymousPipeServerStream pipe,string prefix) {
  var c=new Capture();
  c.task=Task.Run(()=>{var bytes=new byte[4096];int n;while((n=pipe.Read(bytes,0,bytes.Length))>0){
   long previous=Interlocked.Add(ref c.count,n)-n;int keep=(int)Math.Min(n,Math.Max(0,8388608-previous));
   if(keep>0){lock(outputLock){if(c.transportError==null){try{Console.Out.WriteLine(prefix+Convert.ToBase64String(bytes,0,keep));Console.Out.Flush();}catch(Exception ex){c.transportError=ex.GetType().Name+":"+ex.Message;}}}}
  }});return c;
 }
 public static Result Run(string executable,string[] args,string cwd,long deadline,int cleanupMs,string receiptPath,string binding) {
  IntPtr job=CreateJobObject(IntPtr.Zero,null);Check(job!=IntPtr.Zero,"create_job");
  var pi=new ProcessInfo();bool assigned=false;var r=new Result();r.ownerPid=GetCurrentProcessId();r.bindingBase64=binding;
  var stdout=new AnonymousPipeServerStream(PipeDirection.In,HandleInheritability.Inheritable);
  var stderr=new AnonymousPipeServerStream(PipeDirection.In,HandleInheritability.Inheritable);
  try {
   var limits=new Extended();limits.basic.flags=0x2000;int size=Marshal.SizeOf(typeof(Extended));IntPtr mem=Marshal.AllocHGlobal(size);
   try{Marshal.StructureToPtr(limits,mem,false);Check(SetInformationJobObject(job,9,mem,(uint)size),"kill_on_close");r.killOnJobClose=true;}finally{Marshal.FreeHGlobal(mem);}
   string controlError=null;
   var control=Task.Run(()=>{try{return Console.ReadLine();}catch(IOException ex){controlError=ex.GetType().Name+":"+ex.Message;return null;}});
   var si=new Startup();si.cb=(uint)Marshal.SizeOf(typeof(Startup));si.flags=0x101;si.show=0;
   si.output=new IntPtr(long.Parse(stdout.GetClientHandleAsString()));si.error=new IntPtr(long.Parse(stderr.GetClientHandleAsString()));
   var command=new StringBuilder(Quote(executable));foreach(string arg in args)command.Append(" "+Quote(arg));
   Check(CreateProcess(executable,command,IntPtr.Zero,IntPtr.Zero,true,0x08000004,IntPtr.Zero,cwd,ref si,out pi),"create_suspended");
   long creation,exit,kernel,user;Check(GetProcessTimes(pi.process,out creation,out exit,out kernel,out user),"root_identity");
   r.rootCreationDateUtc=DateTime.FromFileTimeUtc(creation).ToString("o");r.rootPid=pi.pid;
   Check(AssignProcessToJobObject(job,pi.process),"assign_job");assigned=true;r.assignedBeforeResume=true;
   stdout.DisposeLocalCopyOfClientHandle();stderr.DisposeLocalCopyOfClientHandle();
   var o=Read(stdout,"O:");var e=Read(stderr,"E:");
   Check(ResumeThread(pi.thread)!=0xffffffff,"resume");
   while(true){
    if(control.IsCompleted){string reason=control.Result;r.stopReason=reason==null?"runner_lost":Encoding.UTF8.GetString(Convert.FromBase64String(reason));break;}
    if(Now()>=deadline){r.stopReason="wall_timeout";break;}
    if(Interlocked.Read(ref o.count)>8388608||Interlocked.Read(ref e.count)>8388608){r.stopReason="maxBuffer exceeded";break;}
    if(WaitForSingleObject(pi.process,25)==0)break;
   }
   var before=Stats(job);r.totalProcesses=before.total;
   if(before.active>0&&!TerminateJobObject(job,1))r.cleanupError="TerminateJobObject failed:"+Marshal.GetLastWin32Error();
   long until=Now()+Math.Max(1,cleanupMs-250);
   while(Stats(job).active>0&&Now()<until)Thread.Sleep(10);
   r.activeProcessesAfterCleanup=Stats(job).active;
   uint code;Check(GetExitCodeProcess(pi.process,out code),"exit_code");r.exitCode=code;
   try{Task.WaitAll(new[]{o.task,e.task},Math.Max(1,(int)(until-Now())));}catch(Exception ex){o.transportError=o.transportError??ex.GetType().Name+":"+ex.Message;}
   try{Publish(receiptPath,binding,r,(controlError??"")+";"+(o.transportError??"")+";"+(e.transportError??""));}catch(Exception ex){r.observationError=ex.GetType().Name+":"+ex.Message;}
   r.stdoutBytes=Interlocked.Read(ref o.count);r.stderrBytes=Interlocked.Read(ref e.count);
   if(!o.task.IsCompleted||!e.task.IsCompleted)throw new Exception("stream close unconfirmed");
   if(r.stdoutBytes>8388608||r.stderrBytes>8388608)r.stopReason=r.stopReason??"maxBuffer exceeded";
   return r;
  }catch(Exception ex){
   try{using(var f=new FileStream(receiptPath+".error",FileMode.CreateNew,FileAccess.Write,FileShare.None)){byte[] b=Encoding.UTF8.GetBytes(ex.ToString());f.Write(b,0,b.Length);f.Flush(true);}}catch{}
   throw;
  }finally{
   if(pi.process!=IntPtr.Zero&&!assigned)TerminateProcess(pi.process,1);
   if(job!=IntPtr.Zero)CloseHandle(job);
   if(pi.thread!=IntPtr.Zero)CloseHandle(pi.thread);
   if(pi.process!=IntPtr.Zero)CloseHandle(pi.process);
   stdout.Dispose();stderr.Dispose();
  }
 }
}
