export type SerialQueue = {
  enqueue: (task: () => Promise<void>) => void;
  idle: () => Promise<void>;
};

export function createSerialQueue(onError: (error: unknown) => void = () => {}): SerialQueue {
  let tail: Promise<void> = Promise.resolve();
  return {
    enqueue(task) {
      tail = tail.then(task).catch((error) => {
        try {
          onError(error);
        } catch {
          // an error handler must not break the queue
        }
      });
    },
    idle() {
      return tail;
    },
  };
}
