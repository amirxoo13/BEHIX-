/** تعریف کمینهٔ pngjs (بستهٔ تایپ رسمی ندارد). فقط همان بخشی که استودیو استفاده می‌کند. */
declare module "pngjs" {
  export class PNG {
    width: number;
    height: number;
    data: Buffer;
    constructor(opts?: { width?: number; height?: number });
    static sync: { read(buffer: Buffer): PNG; write(png: PNG): Buffer };
  }
}
