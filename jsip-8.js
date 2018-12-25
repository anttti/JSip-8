// See screen dimensions: https://raw.githubusercontent.com/wiki/mattmikolay/chip-8/images/screen_diagram.png
const SCREEN_WIDTH = 0x3f;
const SCREEN_HEIGHT = 0x1f;

class JSip8 {
  constructor() {
    this.reset();

    this.load = this.load.bind(this);
    this.reset = this.reset.bind(this);
    this.run = this.run.bind(this);
    this.executeOpcode = this.executeOpcode.bind(this);
    this.executeDelayTimer = this.executeDelayTimer.bind(this);
    this.executeSoundTimer = this.executeSoundTimer.bind(this);
  }

  load(program) {
    this.memory = program;
    console.log("Program loaded");
    this.run();
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
    this.screen = new Array(SCREEN_WIDTH * SCREEN_HEIGHT).fill(0x0);
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

  drawPixel(x, y) {
    // Sprites are XORed onto the existing screen. If this causes any pixels to be erased, VF is set to 1, otherwise it is set to 0. If the sprite is positioned so part of it is outside the coordinates of the display, it wraps around to the opposite side of the screen.

    // Sprites are always eight pixels wide, with a height ranging from one to fifteen pixels.

    // If the program attempts to draw a sprite at an x coordinate greater than 0x3F, the x value will be reduced modulo 64. Similarly, if the program attempts to draw at a y coordinate greater than 0x1F, the y value will be reduced modulo 32. Sprites that are drawn partially off-screen will be clipped.

    // Sprites are drawn to the screen using the DXYN instruction. All sprites are rendered using an exclusive-or (XOR) mode; when a request to draw a sprite is processed, the given sprite's data is XOR'd with the current graphics data of the screen.
    if (x > SCREEN_WIDTH) {
      x -= SCREEN_WIDTH;
    } else if (x < 0) {
      x += SCREEN_WIDTH;
    }

    if (y > SCREEN_HEIGHT) {
      y -= SCREEN_HEIGHT;
    } else if (y < 0) {
      y += SCREEN_HEIGHT;
    }

    const location = x + y * SCREEN_WIDTH;
    const hadAlreadyAPixel = this.screen[location];
    this.screen[location] ^= 1;

    return hadAlreadyAPixel;
  }

  clearScreen() {
    this.screen = new Array(0x3f).fill(new Array(0x1f).fill(0x0));
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
    const opcode = (byte1 << 8) | byte2;

    switch (opcode & 0xf000) {
      case 0x0000: {
        switch (opcode) {
          case 0x00e0:
            /*
            00E0 - CLS
            Clear the display.
            */
            this.clearScreen();
            break;
          case 0x0ee:
            /*
            00EE - RET
            Return from a subroutine.
            The interpreter sets the program counter to the address at the top of the stack, then subtracts 1 from the stack pointer.
            */
            this.pc = this.stack[this.sp];
            this.sp--;
            break;
        }
        break;
      }
      case 0x1000: {
        /*
        1nnn - JP addr
        Jump to location nnn.
        */
        this.pc = opcode & 0x0fff;
        break;
      }
      case 0x2000: {
        /*
        2nnn - CALL addr
        Call subroutine at nnn.
        The interpreter increments the stack pointer, then puts the current PC on the top of the stack. The PC is then set to nnn.
        */
        this.sp++;
        this.stack.push(this.pc);
        this.pc = opcode & 0x0fff;
        break;
      }
      case 0x3000: {
        /*
        3xkk - SE Vx, byte
        Skip next instruction if Vx = kk.
        The interpreter compares register Vx to kk, and if they are equal, increments the program counter by 2.
        */
        const vIndex = (opcode >> 8) & 0x000f;
        if (this.v[vIndex] === (opcode & 0x00ff)) {
          this.pc += 2;
        }
        break;
      }
      case 0x4000: {
        /*
        4xkk - SNE Vx, byte
        Skip next instruction if Vx != kk.
        The interpreter compares register Vx to kk, and if they are not equal, increments the program counter by 2.
        */
        const vIndex = (opcode >> 8) & 0x000f;
        if (this.v[vIndex] !== (opcode & 0x00ff)) {
          this.pc += 2;
        }
        break;
      }
      case 0x5000: {
        /*
        5xy0 - SE Vx, Vy
        Skip next instruction if Vx = Vy.
        The interpreter compares register Vx to register Vy, and if they are equal, increments the program counter by 2.
        */
        const vxIndex = (opcode >> 8) & 0x000f;
        const vyIndex = (opcode >> 4) & 0x000f;
        if (this.v[vxIndex] === this.v[vyIndex]) {
          this.pc += 2;
        }
        break;
      }
      case 0x6000: {
        /*
        6xkk - LD Vx, byte
        Set Vx = kk.
        The interpreter puts the value kk into register Vx.
        */
        const vx = (opcode >> 8) & 0x000f;
        const kk = opcode & 0x00ff;
        this.v[vx] = kk;
        break;
      }
      case 0x7000: {
        /*
        7xkk - ADD Vx, byte
        Set Vx = Vx + kk.
        Adds the value kk to the value of register Vx, then stores the result in Vx. 
        */
        const vx = (opcode >> 8) & 0x000f;
        const kk = opcode & 0xff;
        this.v[vx] = vx + kk;
        break;
      }
      case 0x8000: {
        const lastByte = opcode & 0x000f;
        const x = (opcode >> 8) & 0x000f;
        const y = (opcode >> 4) & 0x000f;

        switch (lastByte) {
          case 0x0:
            /*
            8xy0 - LD Vx, Vy
            Set Vx = Vy.
            Stores the value of register Vy in register Vx.
            */
            this.v[x] = this.v[y];
            break;

          case 0x1:
            /*
            8xy1 - OR Vx, Vy
            Set Vx = Vx OR Vy.
            Performs a bitwise OR on the values of Vx and Vy, then stores the result in Vx.
            */
            this.v[x] = this.v[x] | this.v[y];
            break;

          case 0x2:
            /*
            8xy2 - AND Vx, Vy
            Set Vx = Vx AND Vy.
            Performs a bitwise AND on the values of Vx and Vy, then stores the result in Vx.
            */
            this.v[x] = this.v[x] & this.v[y];
            break;

          case 0x3:
            /*
            8xy3 - XOR Vx, Vy
            Set Vx = Vx XOR Vy.
            Performs a bitwise exclusive OR on the values of Vx and Vy, then stores the result in Vx.
            */
            this.v[x] = this.v[x] ^ this.v[y];
            break;

          case 0x4:
            /*
            8xy4 - ADD Vx, Vy
            Set Vx = Vx + Vy, set VF = carry.
            The values of Vx and Vy are added together. If the result is greater than 8 bits (i.e., > 255,) VF is set to 1, otherwise 0. Only the lowest 8 bits of the result are kept, and stored in Vx.
            */
            if (x + y > 255) {
              this.v[0xf] = 1;
              this.v[x] = (this.v[x] + this.v[y]) & 0x00ff;
            } else {
              this.v[0xf] = 0;
              this.v[x] = this.v[x] + this.v[y];
            }
            break;

          case 0x5:
            /*
            8xy5 - SUB Vx, Vy
            Set Vx = Vx - Vy, set VF = NOT borrow.
            If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is subtracted from Vx, and the results stored in Vx.
            */
            if (this.v[x] > this.v[y]) {
              this.v[0xf] = 1;
            } else {
              this.v[0xf] = 0;
            }
            this.v[x] = this.v[x] - this.v[y];
            if (this.v[x] < 0) {
              this.v[x] += 256;
            }
            break;

          case 0x6:
            /*
            8xy6 - SHR Vx {, Vy}
            Set Vx = Vx SHR 1.
            If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is divided by 2.
            */
            const leastSignificantBit = this.v[x] & 1;
            this.v[0xf] = leastSignificantBit === 1 ? 1 : 0;
            this.v[x] /= 2;
            break;

          case 0x7:
            /*
            8xy7 - SUBN Vx, Vy
            Set Vx = Vy - Vx, set VF = NOT borrow.
            If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is subtracted from Vy, and the results stored in Vx.
            */
            if (this.v[y] > this.v[x]) {
              this.v[0xf] = 1;
            } else {
              this.v[0xf] = 0;
            }
            this.v[x] = this.v[y] - this.v[x];
            if (this.v[x] < 0) {
              this.v[x] += 256;
            }
            break;

          case 0xe:
            /*
            8xyE - SHL Vx {, Vy}
            Set Vx = Vx SHL 1.
            If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0. Then Vx is multiplied by 2.
            */
            this.v[0xf] = this.v[x] & 0x80; // WTF
            this.v[x] <<= 1;
            break;
        }

        break;
      }
      case 0x9000: {
        /*
        9xy0 - SNE Vx, Vy
        Skip next instruction if Vx != Vy.
        The values of Vx and Vy are compared, and if they are not equal, the program counter is increased by 2.
        */
        if (this.v[x] === this.v[y]) {
          this.pc += 2;
        }
        break;
      }
      case 0xa000: {
        /*
        Annn - LD I, addr
        Set I = nnn.
        The value of register I is set to nnn.
        */
        this.i = opcode & 0x0fff;
        break;
      }
      case 0xb000: {
        /*
        Bnnn - JP V0, addr
        Jump to location nnn + V0.
        The program counter is set to nnn plus the value of V0.
        */
        this.pc = (opcode & 0x0fff) + this.v[0];
        break;
      }
      case 0xc000: {
        /*
        Cxkk - RND Vx, byte
        Set Vx = random byte AND kk.
        The interpreter generates a random number from 0 to 255, which is then ANDed with the value kk. The results are stored in Vx.
        */
        const kk = opcode & 0x00ff;
        const random = Math.floor(Math.random() * 0x00ff);
        this.v[x] = random & kk;
        break;
      }
      case 0xd000: {
        /*
        Dxyn - DRW Vx, Vy, nibble
        Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision.
        The interpreter reads n bytes from memory, starting at the address stored in I. These bytes are then displayed as sprites on screen at coordinates (Vx, Vy). Sprites are XORed onto the existing screen. If this causes any pixels to be erased, VF is set to 1, otherwise it is set to 0. If the sprite is positioned so part of it is outside the coordinates of the display, it wraps around to the opposite side of the screen.
        */

        const n = opcode & 0x000f;

        for (let y = 0; y < n; y++) {
          let sprite = this.memory[this.i + y];
          for (let x = 0; x < 8; x++) {
            if ((sprite & 0x80) > 0) {
              this.v[0xf] = this.drawPixel(this.v[x] + x, this.v[y] + y);
            }
            sprite <<= 1;
          }
        }

        break;
      }
      case 0xe000: {
        /*
        Ex9E - SKP Vx
        Skip next instruction if key with the value of Vx is pressed.
        Checks the keyboard, and if the key corresponding to the value of Vx is currently in the down position, PC is increased by 2.

        ExA1 - SKNP Vx
        Skip next instruction if key with the value of Vx is not pressed.
        Checks the keyboard, and if the key corresponding to the value of Vx is currently in the up position, PC is increased by 2.
        */
        console.log("e");
        break;
      }
      case 0xf000: {
        /*
        Fx07 - LD Vx, DT
        Set Vx = delay timer value.
        The value of DT is placed into Vx.

        Fx0A - LD Vx, K
        Wait for a key press, store the value of the key in Vx.
        All execution stops until a key is pressed, then the value of that key is stored in Vx.

        Fx15 - LD DT, Vx
        Set delay timer = Vx.
        DT is set equal to the value of Vx.

        Fx18 - LD ST, Vx
        Set sound timer = Vx.
        ST is set equal to the value of Vx.

        Fx1E - ADD I, Vx
        Set I = I + Vx.
        The values of I and Vx are added, and the results are stored in I.

        Fx29 - LD F, Vx
        Set I = location of sprite for digit Vx.
        The value of I is set to the location for the hexadecimal sprite corresponding to the value of Vx. See section 2.4, Display, for more information on the Chip-8 hexadecimal font.

        Fx33 - LD B, Vx
        Store BCD representation of Vx in memory locations I, I+1, and I+2.
        The interpreter takes the decimal value of Vx, and places the hundreds digit in memory at location in I, the tens digit at location I+1, and the ones digit at location I+2.

        Fx55 - LD [I], Vx
        Store registers V0 through Vx in memory starting at location I.
        The interpreter copies the values of registers V0 through Vx into memory, starting at the address in I.

        Fx65 - LD Vx, [I]
        Read registers V0 through Vx from memory starting at location I.
        The interpreter reads values from memory starting at location I into registers V0 through Vx.
        */
        console.log("f");
        break;
      }
    }
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
  const rom = await loadRom("/BC_test.ch8");
  jsip8.load(rom);
};
