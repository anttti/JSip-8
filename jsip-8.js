class JSip8 {
  constructor() {
    this.reset();

    this.load = this.load.bind(this);
    this.reset = this.reset.bind(this);
    this.run = this.run.bind(this);
    this.executeOpcode = this.executeOpcode.bind(this);
    this.executeDelayTimer = this.executeDelayTimer.bind(this);
    this.executeSoundTimer = this.executeSoundTimer.bind(this);

    this.load();
  }

  load(program) {
    this.memory = program;
    console.log("Program loaded");
    console.log(this.memory);
    // this.run();
  }

  reset() {
    this.memory = new Array(4096);
    this.stack = new Array(16);
    this.pc = 0;
    this.sp = 0;
    this.v = new Array(16);
    this.i = 0;
    this.delayTimer = 0;
    this.soundTimer = 0;
    this.lastCommandRun = new Date().getTime();
    console.log("Emulation state reset");
  }

  run() {
    const now = new Date().getTime();
    if (now - this.lastCommandRun > 1000) {
      this.executeDelayTimer();
      this.executeSoundTimer();
      this.executeOpcode(this.memory[this.pc], this.memory[this.pc + 1]);
      this.pc += 2;
      this.lastCommandRun = now;
    }
    requestAnimationFrame(this.run);
  }

  executeDelayTimer() {
    if (this.delayTimer > 0) {
      this.delayTimer--;
    }
  }

  executeSoundTimer() {
    if (this.soundTimer > 0) {
      this.soundTimer--;
      console.log("BEEP!");
    }
  }

  executeOpcode(byte1, byte2) {
    const opcode = byte1 + byte2;
    console.log(byte1, byte2);
    let hexString = opcode.toString(16);
    if (hexString.length % 2) {
      hexString = "0" + hexString;
    }
    console.log(hexString);

    // switch (opcode)
  }
}

const loadRom = async path => {
  const response = await window.fetch(path);
  const buffer = await response.arrayBuffer();
  const program = new Uint8Array(buffer);
  return program;
};

const start = async () => {
  const jsip8 = new JSip8();
  const rom = loadRom("/BC_test.ch8");
  jsip8.load(rom);
};
