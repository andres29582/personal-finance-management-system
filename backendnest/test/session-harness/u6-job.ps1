param([int]$OwnedPid)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class OwnedJob {
 [StructLayout(LayoutKind.Sequential)] struct Basic { public long a,b; public uint flags; public UIntPtr min,max; public uint count; public UIntPtr affinity; public uint priority,scheduling; }
 [StructLayout(LayoutKind.Sequential)] struct Io { public ulong a,b,c,d,e,f; }
 [StructLayout(LayoutKind.Sequential)] struct Extended { public Basic basic; public Io io; public UIntPtr a,b,c,d; }
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr a,string b);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr a,int b,IntPtr c,uint d);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool QueryInformationJobObject(IntPtr a,int b,IntPtr c,uint d,IntPtr e);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr a,IntPtr b);
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint a,bool b,int c);
 [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr a);
 [DllImport("kernel32.dll", SetLastError=true)] public static extern bool TerminateJobObject(IntPtr a,uint b);
 public static IntPtr Create(int pid) {
  IntPtr job=CreateJobObject(IntPtr.Zero,null); if(job==IntPtr.Zero) throw new Exception("Job unavailable");
  IntPtr memory=Marshal.AllocHGlobal(Marshal.SizeOf(typeof(Extended)));
  try { Extended info=new Extended(); info.basic.flags=0x2000;
   Marshal.StructureToPtr(info,memory,false);
   if(!SetInformationJobObject(job,9,memory,(uint)Marshal.SizeOf(typeof(Extended)))) throw new Exception("Job limits unavailable");
   IntPtr process=OpenProcess(0x0101,false,pid); if(process==IntPtr.Zero) throw new Exception("Owned process unavailable");
   try { if(!AssignProcessToJobObject(job,process)) throw new Exception("Owned job assignment unavailable"); } finally { CloseHandle(process); }
   return job;
  } catch { CloseHandle(job); throw; } finally { Marshal.FreeHGlobal(memory); }
 }
 public static long[] Members(IntPtr job) {
  int bytes=8+IntPtr.Size*256; IntPtr memory=Marshal.AllocHGlobal(bytes);
  try { if(!QueryInformationJobObject(job,3,memory,(uint)bytes,IntPtr.Zero)) throw new Exception("Owned job readback unavailable");
   int n=Marshal.ReadInt32(memory,4); if(n<0||n>256||Marshal.ReadInt32(memory,0)!=n) throw new Exception("Owned job count unqualified");
   long[] ids=new long[n]; for(int i=0;i<n;i++) ids[i]=Marshal.ReadIntPtr(memory,8+i*IntPtr.Size).ToInt64(); return ids;
  } finally { Marshal.FreeHGlobal(memory); }
 }
}
'@
$job = [IntPtr]::Zero
try {
 $creation = (Get-Process -Id $OwnedPid).StartTime.ToUniversalTime().ToString('o')
 $job = [OwnedJob]::Create($OwnedPid)
 @{type='assigned';pid=$OwnedPid;creation=$creation;members=@([OwnedJob]::Members($job))} | ConvertTo-Json -Compress
 while ($null -ne ($line = [Console]::ReadLine())) {
  if ($line -eq 'members') { @{type='members';members=@([OwnedJob]::Members($job))} | ConvertTo-Json -Compress }
  elseif ($line -eq 'close') {
   $ids = @([OwnedJob]::Members($job))
   if ($ids.Count -ne 0) { throw 'Owned descendants remain; completion cannot qualify' }
   break
  } else { throw 'Unknown owned-job request' }
 }
} finally {
 if ($job -ne [IntPtr]::Zero) { [OwnedJob]::CloseHandle($job) | Out-Null }
}
