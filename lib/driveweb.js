const util = require(`util`);
const crypto = require(`crypto`);
const dgram = require(`dgram`);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function SocketClosed(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.extra = extra;
}

util.inherits(SocketClosed, Error);

function SocketTimeout(message, extra) {
  Error.captureStackTrace(this, this.constructor);
  this.name = this.constructor.name;
  this.message = message;
  this.extra = extra;
}

util.inherits(SocketTimeout, Error);

function DriveInterface(ip, config) {
  this.config = Object.assign(
    {},
    {
      timeout: 1000 * 5,
    },
    config
  );
  this.ip = ip;
  this.port = 48556;
  this.PROTOCOL_DEVICE = 0x81;
  this.LEN_WRAPPER = 0x04;
  this.REQ_GET = 0x84;
  this.LEN_GET = 0x04;
  this.REQ_SET = 0x86;
  this.LEN_FLOAT_SET = 0x08;
  this.LEN_SET = 0x06;
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
  this.socket = dgram.createSocket(`udp4`);
  this.messages = {};
  this.socket.on(`message`, (msg) => {
    const seqId = Buffer.from(msg.slice(0, 3)).toString(`hex`);
    this.messages[seqId](msg);
    delete this.messages[seqId];
  });
  return this;
}

async function _getParameter(paramId, pure) {
  const data = Buffer.alloc(this.LEN_WRAPPER + this.LEN_GET);
  data[3] = this.PROTOCOL_DEVICE;
  data[4] = this.LEN_GET;
  data[5] = this.REQ_GET;
  data.writeUInt16BE(paramId, 6);
  const rslt = await this.deviceTransaction(data);
  if (pure) {
    return rslt;
  }

  const n = Buffer.from([rslt[6], rslt[7]]);
  return n.readInt16BE();
}

DriveInterface.prototype.getParameter = async function getParameter(
  paramId,
  pure
) {
  if (Array.isArray(paramId)) {
    return this.getParameters(paramId);
  }

  let retry = 3;
  let v;
  while (retry !== 0) {
    try {
      return await _getParameter.bind(this)(paramId, pure);
    } catch (e) {
      retry = retry - 1;
    }
  }

  if (v) {
    return v;
  }

  throw new SocketTimeout();
};

DriveInterface.prototype.getParameters = function getParameters(paramIds) {
  if (Array.isArray(paramIds)) {
    return Promise.all(paramIds.map((a) => this.getParameter(a)));
  }

  if (!Number.isNaN(paramIds)) {
    return this.getParameter(paramIds);
  }

  return new Promise((resolve) => resolve(null));
};

async function _setParameter(paramId, value) {
  if (paramId !== null && typeof paramId === `object`) {
    return this.setParameters(paramId);
  }

  const data = Buffer.alloc(this.LEN_WRAPPER + this.LEN_SET);
  data[3] = this.PROTOCOL_DEVICE;
  data[4] = this.LEN_SET;
  data[5] = this.REQ_SET;
  data.writeUInt16BE(paramId, 6);
  data.writeInt16BE(value, 8);
  await this.deviceTransaction(data);
  return undefined;
}

DriveInterface.prototype.setParameter = async function setParameter(
  paramId,
  value
) {
  if (paramId !== null && typeof paramId === `object`) {
    return this.setParameters(paramId);
  }

  let retry = 3;
  let v;
  while (retry !== 0) {
    try {
      return await _setParameter.bind(this)(paramId, value);
    } catch (e) {
      retry = retry - 1;
    }
  }

  if (v) {
    return v;
  }

  throw new SocketTimeout();
};

DriveInterface.prototype.setParameters = function setParameters(obj) {
  if (obj !== null && typeof obj === `object`) {
    return Promise.all(
      Object.entries(obj).map((a) => this.setParameter(a[0], a[1]))
    );
  }

  return new Promise((resolve) => {
    resolve([]);
  });
};

DriveInterface.prototype.getFloatParameter = async function getFloatParameter(
  paramId
) {
  const r = await this.getParameter(paramId, true);
  const n = Buffer.from([r[6], r[7], r[8], r[9]]);
  console.log(n.buffer);
  return n.readFloatBE();
};

async function _setFloatParameter(paramId, value) {
  const data = Buffer.alloc(this.LEN_WRAPPER + this.LEN_FLOAT_SET);
  data[3] = this.PROTOCOL_DEVICE;
  data[4] = this.LEN_FLOAT_SET;
  data[5] = this.REQ_SET;
  data.writeUInt16BE(paramId, 6);
  data.writeFloatBE(value, 8);
  await this.deviceTransaction(data);
  return undefined;
}

DriveInterface.prototype.setFloatParameter = async function setFloatParameter(
  paramId,
  value
) {
  let retry = 3;
  let v;
  while (retry !== 0) {
    try {
      return await _setFloatParameter.bind(this)(paramId, value);
    } catch (e) {
      retry = retry - 1;
    }
  }

  if (v) {
    return v;
  }

  throw new SocketTimeout();
};

DriveInterface.prototype.deviceTransaction = function deviceTransaction(pkt) {
  return new Promise(async (resolve, reject) => {
    const self = this;
    let lockRetry = this.LOCK_RETRIES;
    let setupRetry = this.SETUP_RETRIES;
    let deviceRetry = this.DEVICE_RETRIES;
    let commsRetry = this.COMMS_RETRIES;
    async function handle() {
      return new Promise((p) => {
        self.transaction(pkt).then(async (rslt) => { // eslint-disable-line
            if (typeof rslt === `undefined`) {
              commsRetry -= 1;
              if (commsRetry === 0) {
                return reject(`Comms timed out,`);
              }
            } else if (rslt[5] === pkt[5] + 1) {
              return p(rslt);
            } else if (rslt[5] === pkt[5] + 0x21) {
              return reject(`Device return error: ${pkt[6]}`);
            } else if (rslt[5] === self.EX_TYPE) {
              if (rslt[6] === self.EX_LOCK_FAIL) {
                lockRetry -= 1;
                if (lockRetry === 0) {
                  return reject(`Failed to get device lock`);
                }

                await sleep(self.LOCK_SLEEP);
              } else if (rslt[6] === self.EX_LOCK_TIMEOUT) {
                deviceRetry -= 1;
                if (deviceRetry === 0) {
                  return reject(`Device timed out.`);
                }
              } else if (rslt[6] === self.EX_SETUP_FAIL) {
                setupRetry -= 1;
                if (setupRetry === 0) {
                  return reject(`Device is setting up.`);
                }

                await sleep(self.SETUP_SLEEP);
              } else {
                return reject(`Unknown Error: ${rslt[6]}`);
              }
            } else {
              return reject(`Device return unexpected response: ${rslt[5]}`);
            }

            resolve(handle());
          })
          .catch(reject);
      });
    }

    resolve(await handle());
  });
};

DriveInterface.prototype.transaction = function transaction(pkt) {
  if (this._closed) {
    throw new SocketClosed(`Socket Closed`);
  }

  return new Promise(async (resolve, reject) => {
    const data = pkt;
    let seqId = crypto.randomBytes(3);
    [data[0], data[1], data[2]] = seqId;
    seqId = seqId.toString(`hex`);
    this.socket.send(data, this.port, this.ip);
    this.messages[seqId] = (a) => {
      resolve(a);
    };

    setTimeout(() => {
      if (this.messages[seqId]) {
        reject(new SocketTimeout(`Socket Timeout`));
        delete this.messages[seqId];
      }
    }, this.config.timeout);
  });
};

DriveInterface.prototype.close = function close() {
  this._closed = true;
  this.socket.close();
};

DriveInterface.SocketClosed = SocketClosed;
DriveInterface.SocketTimeout = SocketTimeout;

module.exports = DriveInterface;
