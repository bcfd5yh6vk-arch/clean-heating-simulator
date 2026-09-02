"use strict";

/**
 * 极小的 8 位灰度 PNG 解码器，只为测试用。
 *
 * 为什么要自己写：浏览器里 Köppen 栅格是用 canvas 读的，node 里没有 canvas。
 * 但「仓库里那个 PNG 到底对不对」必须在 npm test 里就能验证，不能只靠人工开浏览器看。
 * 8 位灰度、非隔行的 PNG 解码只有几十行，比引一个图像库划算。
 *
 * 只支持 bit depth 8 / color type 0 / interlace 0 —— 正是 build_map_data.py 写出的格式。
 * 其余格式一律抛错，不做静默兼容：格式变了就该让测试炸掉。
 */

const zlib = require("node:zlib");

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * @param {Buffer} buf 完整的 PNG 文件字节
 * @returns {{width:number,height:number,data:Uint8Array,chunks:string[]}}
 *          data 长度为 width*height，每个字节即该像素的灰度值
 */
function decodeGrayPng(buf) {
  if (!buf.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error("不是 PNG：签名不匹配");
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat = [];
  const chunks = [];

  let p = 8;
  while (p + 8 <= buf.length) {
    const length = buf.readUInt32BE(p);
    const type = buf.toString("ascii", p + 4, p + 8);
    const body = buf.subarray(p + 8, p + 8 + length);
    chunks.push(type);

    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      bitDepth = body[8];
      colorType = body[9];
      interlace = body[12];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(body));
    } else if (type === "IEND") {
      break;
    }
    p += 12 + length; // length(4) + type(4) + data + crc(4)
  }

  if (bitDepth !== 8 || colorType !== 0 || interlace !== 0) {
    throw new Error(
      `只支持 8 位灰度非隔行 PNG，实际 bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`,
    );
  }
  if (idat.length === 0) throw new Error("PNG 里没有 IDAT");

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width; // 灰度 8 位 → 每像素 1 字节
  const expected = (stride + 1) * height;
  if (raw.length !== expected) {
    throw new Error(`解压后 ${raw.length} 字节，按 ${width}x${height} 预期 ${expected}`);
  }

  const out = new Uint8Array(width * height);
  let prev = new Uint8Array(stride); // 上一行（已还原）
  let src = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const line = new Uint8Array(stride);
    for (let x = 0; x < stride; x += 1) {
      const cur = raw[src + x];
      const a = x >= 1 ? line[x - 1] : 0; // 左
      const b = prev[x]; // 上
      const c = x >= 1 ? prev[x - 1] : 0; // 左上
      let value;
      switch (filter) {
        case 0: value = cur; break;
        case 1: value = cur + a; break;
        case 2: value = cur + b; break;
        case 3: value = cur + ((a + b) >> 1); break;
        case 4: value = cur + paeth(a, b, c); break;
        default: throw new Error(`第 ${y} 行的滤波类型 ${filter} 非法`);
      }
      line[x] = value & 0xff;
    }
    out.set(line, y * width);
    prev = line;
    src += stride;
  }

  return { width, height, data: out, chunks };
}

module.exports = { decodeGrayPng };
