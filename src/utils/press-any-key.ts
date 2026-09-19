export const pressAnyKey = async () => {
  return new Promise<void>((resolve) => {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", () => {
      resolve();
    });
  });
};
