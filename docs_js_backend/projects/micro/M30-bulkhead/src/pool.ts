export class Pool {
  private name: string;
  private max: number;
  private active: number;

  constructor(name: string, max: number) {
    this.name = name;
    this.max = max;
    this.active = 0;
  }

  hasCapacity(): boolean {
    return this.active < this.max;
  }

  acquire(): void {
    if (!this.hasCapacity()) {
      throw new Error('Pool is at capacity');
    }
    this.active++;
  }

  release(): void {
    if (this.active > 0) {
      this.active--;
    }
  }

  getMax(): number {
    return this.max;
  }

  getActive(): number {
    return this.active;
  }

  getName(): string {
    return this.name;
  }
}
