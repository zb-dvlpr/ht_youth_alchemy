export const mapWithConcurrency = async <T, R>(
  list: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  if (list.length === 0) return [];
  const safeConcurrency = Math.max(1, Math.floor(concurrency));
  const results: R[] = new Array(list.length);
  let cursor = 0;

  const runWorker = async () => {
    while (cursor < list.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(list[index], index);
    }
  };

  const runners = Array.from(
    { length: Math.min(safeConcurrency, list.length) },
    () => runWorker()
  );
  await Promise.all(runners);
  return results;
};
