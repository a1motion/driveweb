export default class Struct {
    format: string;
    fns: any[];
    size: number;
    m: any;
    t: any;
    lu: any;
    rechk: RegExp;
    refmt: RegExp;
    errbuf: RangeError;
    errval: RangeError;
    constructor(format: string);
    str: (v: any, o: any, c: any) => string;
    rts: (v: any, o: any, c: any, s: any) => void;
    pst: (v: any, o: any, c: any) => string;
    tsp: (v: any, o: any, c: any, s: any) => void;
    lut: (le: any) => {
        "?": (c: any) => any[];
        "B": (c: any) => any[];
        "H": (c: any) => any[];
        "I": (c: any) => any[];
        "b": (c: any) => any[];
        "c": (c: any) => any[];
        "d": (c: any) => any[];
        "f": (c: any) => any[];
        "h": (c: any) => any[];
        "i": (c: any) => any[];
        "p": (c: any) => any[];
        "s": (c: any) => any[];
        "x": (c: any) => any[];
    };
    unpack_from(arrb: any, offs: any): any[];
    pack_into(arrb: any, offs: any, ...values: any[]): void;
    pack(...values: any[]): ArrayBuffer;
    unpack(arrb: any): any[];
    iter_unpack(arrb: any): IterableIterator<any[]>;
}
