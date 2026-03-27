import { spawn } from "child_process";

const workers = {};

export function startWorker(name, command, scriptPath) {

  if (workers[name]) {
    console.log(`${name} already running`);
    return;
  }

  const worker = spawn(command, [scriptPath]);

  workers[name] = worker;

  worker.stdout.on("data", (data) => {
    console.log(`${name}: ${data}`);
  });

  worker.stderr.on("data", (data) => {
    console.error(`${name} ERROR: ${data}`);
  });

  worker.on("close", () => {
    console.log(`${name} stopped`);
    delete workers[name];
  });

}

export function stopWorker(name) {
  const worker = workers[name];
  if (worker) {
    worker.kill();
    delete workers[name];
  }
}

export function getWorkers() {
  return Object.keys(workers);
}