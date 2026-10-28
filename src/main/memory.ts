import { app } from 'electron';
import type { MemorySnapshot } from '../shared/model';
export function measureMemory(): MemorySnapshot {
  const processes = app.getAppMetrics().map(p => ({ pid: p.pid, type: p.type, residentMB: p.memory.workingSetSize / 1024, cpu: p.cpu.percentCPUUsage }));
  return { at: Date.now(), residentMB: processes.reduce((sum, p) => sum + p.residentMB, 0), processes };
}
