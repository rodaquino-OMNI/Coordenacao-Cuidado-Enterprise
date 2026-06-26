/**
 * Performance Test Helpers
 * Utilities for measuring test performance and benchmarking
 */

export class PerformanceTester {
  private static measurements: Array<{ name: string; duration: number; memory: number }> = [];

  static async measureAsync<T>(
    name: string, 
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number; memory: number }> {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage().heapUsed;
    
    const result = await fn();
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage().heapUsed;
    
    const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
    const memory = endMemory - startMemory;
    
    this.measurements.push({ name, duration, memory });
    
    return { result, duration, memory };
  }

  static getReport() {
    const report = {
      totalTests: this.measurements.length,
      averageDuration: this.measurements.reduce((sum, m) => sum + m.duration, 0) / this.measurements.length,
      maxDuration: Math.max(...this.measurements.map(m => m.duration)),
      minDuration: Math.min(...this.measurements.map(m => m.duration)),
      totalMemoryUsed: this.measurements.reduce((sum, m) => sum + Math.max(0, m.memory), 0),
      measurements: this.measurements,
    };
    
    return report;
  }

  static reset() {
    this.measurements = [];
  }

  static async benchmarkEndpoint(
    requestFn: () => Promise<any>,
    iterations: number = 100
  ) {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const measurement = await this.measureAsync(`benchmark_${i}`, requestFn);
      results.push(measurement);
    }
    
    const durations = results.map(r => r.duration);
    const memories = results.map(r => r.memory);
    
    return {
      iterations,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / iterations,
      p95Duration: this.percentile(durations, 95),
      p99Duration: this.percentile(durations, 99),
      maxDuration: Math.max(...durations),
      minDuration: Math.min(...durations),
      averageMemory: memories.reduce((sum, m) => sum + m, 0) / iterations,
      maxMemory: Math.max(...memories),
      totalMemory: memories.reduce((sum, m) => sum + Math.max(0, m), 0),
    };
  }

  private static percentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }
}
