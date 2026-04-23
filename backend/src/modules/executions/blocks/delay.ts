export async function runDelay(props: Record<string, unknown>): Promise<unknown> {
  const seconds = Math.min(Number(props['seconds']) || 1, 30);
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  return { delayed: seconds };
}
