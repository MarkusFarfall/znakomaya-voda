/**
 * Minimal Path2D recorder for Node-only canvas mocks. The renderers still draw into
 * the mock contexts; this only supplies the browser path object API they call.
 */
export type PathCommand = { name: string; args: readonly (number | PathCommand[])[] };

export class MockPath2D {
  static readonly instances: MockPath2D[] = [];
  readonly commands: PathCommand[] = [];

  constructor(path?: MockPath2D) {
    if (path instanceof MockPath2D) this.commands.push(...path.commands);
    MockPath2D.instances.push(this);
  }

  private add(name: string, ...args: number[]) {
    if (!args.every(Number.isFinite)) throw new Error(`Path2D.${name} received non-finite geometry`);
    this.commands.push({ name, args });
  }

  moveTo(x: number, y: number) { this.add("moveTo", x, y); }
  lineTo(x: number, y: number) { this.add("lineTo", x, y); }
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number) {
    this.add("bezierCurveTo", cp1x, cp1y, cp2x, cp2y, x, y);
  }
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    this.add("quadraticCurveTo", cpx, cpy, x, y);
  }
  arc(x: number, y: number, radius: number, start: number, end: number, ccw = false) {
    if (radius < 0) throw new Error("Path2D.arc received a negative radius");
    this.add("arc", x, y, radius, start, end, Number(ccw));
  }
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, start: number, end: number, ccw = false) {
    if (radiusX < 0 || radiusY < 0) throw new Error("Path2D.ellipse received a negative radius");
    this.add("ellipse", x, y, radiusX, radiusY, rotation, start, end, Number(ccw));
  }
  rect(x: number, y: number, width: number, height: number) { this.add("rect", x, y, width, height); }
  closePath() { this.commands.push({ name: "closePath", args: [] }); }
  addPath(path: MockPath2D) { this.commands.push({ name: "addPath", args: [path.commands] }); }
}

if (!("Path2D" in globalThis)) {
  Object.defineProperty(globalThis, "Path2D", {
    configurable: true,
    writable: true,
    value: MockPath2D,
  });
}
