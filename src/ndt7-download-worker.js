/* eslint-env browser, node, worker */

// Node doesn't have WebSocket defined, so it needs this library.
if (typeof WebSocket === 'undefined') {
  global.WebSocket = require('isomorphic-ws');
}

// workerMain is the WebWorker function that runs the ndt7 download test.
const workerMain = function(ev) {
  'use strict';
  const url = ev.data['download'];
  const sock = new WebSocket(url, 'net.measurementlab.ndt.v7');
  let now = () => new Date().getTime();
  if (typeof performance !== 'undefined' &&
      typeof performance.now !== 'undefined') {
    now = () => performance.now();
  }
  downloadTest(sock, postMessage, now);
};

/**
 * downloadTest is a function that runs an ndt7 download test using the
 * passed-in websocket instance and the passed-in callback function.  The
 * socket and callback are passed in to enable testing and mocking.
 *
 * @param {WebSocket} sock - The WebSocket being read.
 * @param {function} postMessage - A function for messages to the main thread.
 * @param {function} now - A function returning a time in milliseconds.
 */
const downloadTest = function(sock, postMessage, now) {
  sock.onclose = function(ev) {
    console.log(ev);
    postMessage({
      MsgType: 'closed',
      code: ev.code
    });
  };

  sock.onerror = function(ev) {
    console.log(ev); //this is useless, using close event instead
  };

  let start = now();
  let previous = start;
  let total = 0;

  sock.onopen = function() {
    start = now();
    previous = start;
    total = 0;
  };

  sock.onmessage = function(ev) {
    total += (typeof ev.data.size !== 'undefined') ? ev.data.size : ev.data.length;
    // Perform a client-side measurement 4 times per second.
    const currentTime = now();
    const every = 250; // ms
    if ((currentTime - previous) > every) {
      postMessage({
        MsgType: 'measurement',
        ClientData: {
          ElapsedTime: (currentTime - start) / 1000, // seconds
          NumBytes: total,
          // MeanClientMbps is calculated via the logic:
          //  (bytes) * (bits / byte) * (megabits / bit) = Megabits
          //  (Megabits) * (1/milliseconds) * (milliseconds / second) = Mbps
          // Collect the conversion constants, we find it is 8*1000/1000000
          // When we simplify we get: 8*1000/1000000 = .008
          MeanClientMbps: (total / (currentTime - start)) * 0.008
        },
        Source: 'client',
        Test: 'download'
      });
      previous = currentTime;
    }

    // Pass along every server-side measurement.
    if (typeof ev.data === 'string') {
      postMessage({
        MsgType: 'measurement',
        ServerData: JSON.parse(ev.data),
        Source: 'server',
      });
    }
  };
};

// Node and browsers get onmessage defined differently.
if (typeof self !== 'undefined') {
  self.onmessage = workerMain;
} else if (typeof this !== 'undefined') {
  this.onmessage = workerMain;
} else if (typeof onmessage !== 'undefined') {
  onmessage = workerMain;
}
