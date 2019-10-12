export function sleep(msecs: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, msecs));
}
