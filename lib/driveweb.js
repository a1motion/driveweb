const struct = require('./struct');
const crypto = require('crypto');
const dgram = require('dgram');

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function DriveInterface(ip) {
  this.ip = ip;
  this.port = 48556;
  this.PROTOCOL_DEVICE = 0x81;
  this.LEN_WRAPPER = 4;
  this.REQ_GET = 0x84;
  this.LEN_GET = 4;
  this.REQ_SET = 0x86;
  this.LEN_SET = 6;
  this.EX_TYPE = 0xff;
  this.EX_LOCK_FAIL = 0xff;
  this.EX_LOCK_TIMEOUT = 0xfe;
  this.EX_SETUP_FAIL = 0xfd;
  this.LOCK_SLEEP = 10;
  this.LOCK_RETRIES = 20;
  this.SETUP_SLEEP = 200;
  this.SETUP_RETRIES = 2;
  this.COMMS_RETRIES = 1;
  this.DEVICE_RETRIES = 1;
  this.socket = dgram.createSocket('udp4');
  this.messages = {};
  this.socket.on('message', (msg) => {
    const seqId = Buffer.from(msg.slice(0, 3)).toString('hex');
    this.messages[seqId](msg);
    delete this.messages[seqId];
  });
  this.getParameter = function getParameter(paramId) {
    if (Array.isArray(paramId)) {
      return this.getParameters(paramId);
    }
    return new Promise(async (resolve, reject) => {
      const data = Buffer.alloc(this.LEN_WRAPPER + this.LEN_GET);
      data[3] = this.PROTOCOL_DEVICE;
      data[4] = this.LEN_GET;
      data[5] = this.REQ_GET;
      const s = struct('>H');
      const p = Buffer.from(s.pack(paramId));
      [data[6], data[7]] = p;
      this.deviceTransaction(data).then((rslt) => {
        let n = ((rslt[6] << 8) | (rslt[7] & 0xff));
        if (n > 32768) n = -(65536 - n);
        resolve(n);
      }).catch(reject);
    });
  };
  this.getParameters = function getParameters(paramIds) {
    if (Array.isArray(paramIds)) {
      return Promise.all(paramIds.map(a => this.getParameter(a)));
    } else if (!Number.isNaN(paramIds)) {
      return this.getParameter(paramIds);
    }
    return new Promise(resolve => resolve(null));
  };
  this.setParameter = function setParameter(paramId, value) {
    if (paramId !== null && typeof paramId === 'object') {
      return this.setParameters(paramId);
    }
    return new Promise(async (resolve, reject) => {
      const data = Buffer.alloc(this.LEN_WRAPPER + this.LEN_SET);
      data[3] = this.PROTOCOL_DEVICE;
      data[4] = this.LEN_SET;
      data[5] = this.REQ_SET;
      const s = struct('>H');
      const p = Buffer.from(s.pack(paramId));
      [data[6], data[7]] = p;
      let v = value;
      if (v < 0) v = 65536 + v;
      const d = Buffer.from(s.pack(v));
      [data[8], data[9]] = d;
      this.deviceTransaction(data).then(() => {
        this.getParameter(paramId).then((t) => {
          if (t !== value) {
            reject('Value not set.');
          } else {
            resolve(t);
          }
        }).catch(reject);
      }).catch(reject);
    });
  };
  this.setParameters = function setParameters(obj) {
    if (obj !== null && typeof obj === 'object') {
      return Promise.all(Object.entries(obj).map(a => this.setParameter(a[0], a[1])));
    }
    return new Promise((resolve) => {
      resolve([]);
    });
  };
  this.deviceTransaction = function deviceTransaction(pkt) {
    return new Promise(async (resolve, reject) => {
      let lockRetry = this.LOCK_RETRIES;
      let setupRetry = this.SETUP_RETRIES;
      let deviceRetry = this.DEVICE_RETRIES;
      let commsRetry = this.COMMS_RETRIES;
      async function handle() {
        return new Promise((p) => {
          this.transaction(pkt).then(async (rslt) => { // eslint-disable-line
            if (typeof (rslt) === 'undefined') {
              commsRetry -= 1;
              if (commsRetry === 0) {
                return reject('Comms timed out,');
              }
            } else if (rslt[5] === (pkt[5] + 1)) {
              return p(rslt);
            } else if (rslt[5] === (pkt[5] + 0x21)) {
              return reject(`Device return error: ${pkt[6]}`);
            } else if (rslt[5] === this.EX_TYPE) {
              if (rslt[6] === this.EX_LOCK_FAIL) {
                lockRetry -= 1;
                if (lockRetry === 0) {
                  return reject('Failed to get device lock');
                } else {
                  await sleep(this.LOCK_SLEEP);
                }
              } else if (rslt[6] === this.EX_LOCK_TIMEOUT) {
                deviceRetry -= 1;
                if (deviceRetry === 0) {
                  return reject('Device timed out.');
                }
              } else if (rslt[6] === this.EX_SETUP_FAIL) {
                setupRetry -= 1;
                if (setupRetry === 0) {
                  return reject('Device is setting up.');
                } else {
                  await sleep(this.SETUP_SLEEP);
                }
              } else {
                return reject(`Unknown Error: ${rslt[6]}`);
              }
            } else {
              return reject(`Device return unexpected response: ${rslt[5]}`);
            }
            resolve(handle());
          }).catch(reject);
        });
      }
      resolve(await handle());
    });
  };
  this.transaction = function transaction(pkt) {
    return new Promise(async (resolve, reject) => {
      const data = pkt;
      let seqId = crypto.randomBytes(3);
      [data[0], data[1], data[2]] = seqId;
      seqId = seqId.toString('hex');
      this.socket.send(data, this.port, this.ip);
      this.messages[seqId] = (a) => {
        resolve(a);
      };
      setTimeout(() => {
        if (this.messages[seqId]) {
          reject('Socket Timeout');
        }
      }, 1000 * 10);
    });
  };

  return this;
}
module.exports = DriveInterface;