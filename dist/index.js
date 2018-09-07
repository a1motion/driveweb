"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = __importDefault(require("crypto"));
const dgram_1 = __importDefault(require("dgram"));
const struct_1 = __importDefault(require("./struct"));
class DriveInterface {
    constructor(ip) {
        this.ip = "0.0.0.0";
        this.PORT = 48556;
        this.PROTOCOL_DEVICE = 0x81;
        this.LEN_WRAPPER = 0x04;
        this.REQ_GET = 0x84;
        this.LEN_GET = 0x04;
        this.REQ_SET = 0x86;
        this.LEN_SET = 0x06;
        this.EX_TYPE = 0xFF;
        this.EX_LOCK_FAIL = 0xFF;
        this.EX_LOCK_TIMEOUT = 0xFE;
        this.EX_SETUP_FAIL = 0xFD;
        this.LOCK_SLEEP = 10;
        this.LOCK_RETRIES = 20;
        this.SETUP_SLEEP = 200;
        this.SETUP_RETRIES = 2;
        this.COMMS_RETRIES = 2;
        this.DEVICE_RETRIES = 1;
        this.socket = dgram_1.default.createSocket("udp4");
        this.messages = {};
        this.ip = ip;
        this.socket.on("message", (msg) => {
            const seqId = Buffer.from(msg.slice(0, 3)).toString("hex");
            this.messages[seqId](msg);
            delete this.messages[seqId];
        });
    }
    getParameter(paramId) {
        return new Promise((resolve, reject) => {
            if (typeof (paramId) !== "number") {
                return reject("Parameter ID must be a integer");
            }
            else if (paramId > 65535) {
                return reject("Parameter ID must be able to fit into two bytes (< 65536)");
            }
            else if (paramId < 0) {
                return reject("Parameter ID must atleast 0");
            }
            const data = Buffer.alloc(this.LEN_WRAPPER + this.LEN_GET);
            data[3] = this.PROTOCOL_DEVICE;
            data[4] = this.LEN_GET;
            data[5] = this.REQ_GET;
            const s = new struct_1.default(">H");
            const p = Buffer.from(s.pack(paramId));
            [data[6], data[7]] = p;
            this.deviceTransaction(data).then((rslt) => {
                let n = ((rslt[6] << 8) | (rslt[7] & 0xff));
                if (n > 32768) {
                    n = -(65536 - n);
                }
                resolve(n);
            }).catch(reject);
        });
    }
    getParameters(paramIds) {
        return new Promise((resolve, reject) => {
            if (!Array.isArray(paramIds)) {
                return reject("Parameters must be a array.");
            }
            let error = "";
            if (paramIds.some((paramId, index) => {
                if (typeof (paramId) !== "number") {
                    error = "Parameter ID [Index: " + index + "] must be a integer";
                    return true;
                }
                else if (paramId > 65535) {
                    error = "Parameter ID [Index: " + index + "] must be able to fit into two bytes (< 65536)";
                    return true;
                }
                else if (paramId < 0) {
                    error = "Parameter ID [Index: " + index + "] must atleast 0";
                    return true;
                }
                return false;
            })) {
                return reject(error);
            }
            Promise.all(paramIds.map((a) => this.getParameter(a))).then(resolve).catch(reject);
        });
    }
    setParameter(paramId, value) {
        return new Promise((resolve, reject) => {
            if (typeof (paramId) !== "number") {
                return reject("Parameter ID must be a integer");
            }
            else if (paramId > 65535) {
                return reject("Parameter ID must be able to fit into two bytes (< 65536)");
            }
            else if (paramId < 0) {
                return reject("Parameter ID must atleast 0");
            }
            if (typeof (value) !== "number") {
                return reject("Value must be a integer");
            }
            else if (value > 65535) {
                return reject("Value must be able to fit into two bytes (< 65536)");
            }
            else if (value < 0) {
                return reject("Value must atleast 0");
            }
            const data = Buffer.alloc(this.LEN_WRAPPER + this.LEN_SET);
            data[3] = this.PROTOCOL_DEVICE;
            data[4] = this.LEN_SET;
            data[5] = this.REQ_SET;
            const s = new struct_1.default(">H");
            const p = Buffer.from(s.pack(paramId));
            [data[6], data[7]] = p;
            let v = value;
            if (v < 0) {
                v = 65536 + v;
            }
            const d = Buffer.from(s.pack(v));
            [data[8], data[9]] = d;
            this.deviceTransaction(data).then(() => {
                this.getParameter(paramId).then((t) => {
                    if (t !== value) {
                        reject("Value not set.");
                    }
                    else {
                        resolve(t);
                    }
                }).catch(reject);
            }).catch(reject);
        });
    }
    setParameters(paramMap) {
        return new Promise((resolve, reject) => {
            if (paramMap === null || typeof (paramMap) !== "object") {
                reject("No Parameter map provided");
            }
            let error = "";
            if (Object.keys(paramMap).some((paramIdT, index) => {
                const paramId = parseInt(paramIdT, 10);
                if (typeof (paramId) !== "number" || Number.isNaN(paramId)) {
                    error = "Parameter ID [ID: " + paramIdT + "] must be a integer";
                    return true;
                }
                else if (paramId > 65535) {
                    error = "Parameter ID [ID: " + paramIdT + "] must be able to fit into two bytes (< 65536)";
                    return true;
                }
                else if (paramId < 0) {
                    error = "Parameter ID [ID: " + paramIdT + "] must atleast 0";
                    return true;
                }
                return false;
            })) {
                return reject(error);
            }
            if (Object.keys(paramMap).some((paramIdT, index) => {
                const paramId = paramMap[paramIdT];
                if (typeof (paramId) !== "number" || Number.isNaN(paramId)) {
                    error = "Value [ID: " + paramIdT + "] must be a integer";
                    return true;
                }
                else if (paramId > 65535) {
                    error = "Value [ID: " + paramIdT + "] must be able to fit into two bytes (< 65536)";
                    return true;
                }
                else if (paramId < 0) {
                    error = "Value ID [ID: " + paramIdT + "] must atleast 0";
                    return true;
                }
                return false;
            })) {
                return reject(error);
            }
            const obj = {};
            Promise.all(Object.keys(paramMap).map((key) => {
                return new Promise((res, rej) => {
                    this.setParameter(parseInt(key, 10), paramMap[key]).then((value) => {
                        obj[key] = value;
                    }).catch(rej);
                });
            })).then(() => {
                resolve(obj);
            }).catch(reject);
        });
    }
    sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }
    deviceTransaction(pkt) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            let lockRetry = this.LOCK_RETRIES;
            let setupRetry = this.SETUP_RETRIES;
            let deviceRetry = this.DEVICE_RETRIES;
            let commsRetry = this.COMMS_RETRIES;
            const handle = () => __awaiter(this, void 0, void 0, function* () {
                return new Promise((p) => {
                    this.transaction(pkt).then((rslt) => __awaiter(this, void 0, void 0, function* () {
                        if (typeof (rslt) === "undefined") {
                            if (commsRetry === 0) {
                                return reject("Comms timed out");
                            }
                            commsRetry--;
                        }
                        else if (rslt[5] === (pkt[5] + 1)) {
                            return p(rslt);
                        }
                        else if (rslt[5] === (pkt[5] + 0x25)) {
                            return reject("Device returned error: " + pkt[6]);
                        }
                        else if (rslt[5] === this.EX_TYPE) {
                            if (rslt[6] === this.EX_LOCK_FAIL) {
                                if (lockRetry === 0) {
                                    return reject("Failed to get device lock");
                                }
                                else {
                                    lockRetry--;
                                    yield this.sleep(this.LOCK_SLEEP);
                                }
                            }
                            else if (rslt[6] === this.EX_LOCK_TIMEOUT) {
                                if (deviceRetry === 0) {
                                    return reject("Device timed out.");
                                }
                                deviceRetry--;
                            }
                            else if (rslt[6] === this.EX_SETUP_FAIL) {
                                if (setupRetry === 0) {
                                    return reject("Device is setting up.");
                                }
                                else {
                                    setupRetry--;
                                    yield this.sleep(this.SETUP_SLEEP);
                                }
                            }
                            else {
                                return reject(`Unknown Error: ${rslt[6]}`);
                            }
                        }
                    }));
                });
            });
            resolve(yield handle());
        }));
    }
    transaction(pkt) {
        return new Promise((resolve, reject) => {
            const seqId = crypto_1.default.randomBytes(3);
            [pkt[0], pkt[1], pkt[2]] = seqId;
            const seqIdH = seqId.toString("hex");
            this.socket.send(pkt, this.PORT, this.ip);
            this.messages[seqIdH] = (a) => {
                resolve(a);
            };
            setTimeout(() => {
                if (this.messages[seqIdH]) {
                    reject("Socket Timeout");
                }
            }, 1000 * 10);
        });
    }
}
exports.default = DriveInterface;
