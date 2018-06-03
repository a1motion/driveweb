# driveweb
Driveweb Interface

## Install
With ```yarn```:
```
yarn add driveweb
```
or with `npm`:
```bash
npm i -S driveweb
```

## Usage
Basic Example
```js
const driveweb = require('driveweb');

// Create an instance by passing the device's ip.
const smarty = driveweb('192.168.51.2');

// Get a paramter by passing its ids or an array of ids:
const speed = await smarty.getParameter(5026);

// Set an parameter:
const newSpeed = await smarty.setParameter(5026, 100);
```
