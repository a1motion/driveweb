"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Struct {
    constructor(format) {
        this.fns = [];
        this.size = 0;
        this.rechk = /^([<>])?(([1-9]\d*)?([xcbB?hHiIfdsp]))*$/;
        this.refmt = /([1-9]\d*)?([xcbB?hHiIfdsp])/g;
        this.errbuf = new RangeError("Structure larger than remaining buffer");
        this.errval = new RangeError("Not enough values for structure");
        this.str = (v, o, c) => String.fromCharCode(...new Uint8Array(v.buffer, v.byteOffset + o, c));
        this.rts = (v, o, c, s) => (new Uint8Array(v.buffer, v.byteOffset + o, c))
            .set(s.split("").map((str) => str.charCodeAt(0)));
        this.pst = (v, o, c) => this.str(v, o + 1, Math.min(v.getUint8(o), c - 1));
        this.tsp = (v, o, c, s) => { v.setUint8(o, s.length); this.rts(v, o + 1, c - 1, s); };
        this.lut = (le) => ({
            "?": (c) => [c, 1, (o) => ({ u: (v) => Boolean(v.getUint8(o)), p: (v, B) => v.setUint8(o, B) })],
            "B": (c) => [c, 1, (o) => ({ u: (v) => v.getUint8(o), p: (v, B) => v.setUint8(o, B) })],
            "H": (c) => [c, 2, (o) => ({ u: (v) => v.getUint16(o, le), p: (v, H) => v.setUint16(o, H, le) })],
            "I": (c) => [c, 4, (o) => ({ u: (v) => v.getUint32(o, le), p: (v, I) => v.setUint32(o, I, le) })],
            "b": (c) => [c, 1, (o) => ({ u: (v) => v.getInt8(o), p: (v, b) => v.setInt8(o, b) })],
            "c": (c) => [c, 1, (o) => ({ u: (v) => this.str(v, o, 1), p: (v, d) => this.rts(v, o, 1, d) })],
            "d": (c) => [c, 8, (o) => ({ u: (v) => v.getFloat64(o, le), p: (v, d) => v.setFloat64(o, d, le) })],
            "f": (c) => [c, 4, (o) => ({ u: (v) => v.getFloat32(o, le), p: (v, f) => v.setFloat32(o, f, le) })],
            "h": (c) => [c, 2, (o) => ({ u: (v) => v.getInt16(o, le), p: (v, h) => v.setInt16(o, h, le) })],
            "i": (c) => [c, 4, (o) => ({ u: (v) => v.getInt32(o, le), p: (v, i) => v.setInt32(o, i, le) })],
            "p": (c) => [1, c, (o) => ({ u: (v) => this.pst(v, o, c), p: (v, s) => this.tsp(v, o, c, s.slice(0, c - 1)) })],
            "s": (c) => [1, c, (o) => ({ u: (v) => this.str(v, o, c), p: (v, s) => this.rts(v, o, c, s.slice(0, c)) })],
            "x": (c) => [1, c, 0],
        });
        this.format = format;
        this.m = this.rechk.exec(format);
        if (!this.m) {
            throw new RangeError("Invalid format string");
        }
        this.t = this.lut("<" === this.m[1]);
        this.lu = (n, c) => this.t[c](n ? parseInt(n, 10) : 1);
        while ((this.m = this.refmt.exec(format))) {
            ((...args) => {
                const r = arguments[0];
                const s = arguments[1];
                const f = arguments[2];
                for (let i = 0; i < r; ++i, this.size += s) {
                    if (f) {
                        this.fns.push(f(this.size));
                    }
                }
            })(...this.lu(...this.m.slice(1)));
        }
    }
    unpack_from(arrb, offs) {
        if (arrb.byteLength < (offs | 0) + this.size) {
            throw this.errbuf;
        }
        const v = new DataView(arrb, offs | 0);
        return this.fns.map((f) => f.u(v));
    }
    pack_into(arrb, offs, ...values) {
        if (values.length < this.fns.length) {
            throw this.errval;
        }
        if (arrb.byteLength < offs + this.size) {
            throw this.errbuf;
        }
        const v = new DataView(arrb, offs);
        new Uint8Array(arrb, offs, this.size).fill(0);
        this.fns.forEach((f, i) => f.p(v, values[i]));
    }
    pack(...values) {
        const b = new ArrayBuffer(this.size);
        this.pack_into(b, 0, ...values);
        return b;
    }
    unpack(arrb) {
        return this.unpack_from(arrb, 0);
    }
    *iter_unpack(arrb) {
        for (let offs = 0; offs + this.size <= arrb.byteLength; offs += this.size) {
            yield this.unpack_from(arrb, offs);
        }
    }
}
exports.default = Struct;
