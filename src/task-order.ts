async function work(): Promise<void> {
  console.log("2. inside work(), before await");
  await null;
  console.log("4. inside work(), after await");
}

console.log("1. sync: start");
setTimeout(() => console.log("6. setTimeout 0"), 0);
work();
Promise.resolve().then(() => console.log("5. promise .then"));
console.log("3. sync: end (work() has already returned)");
