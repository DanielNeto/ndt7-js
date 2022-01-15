/* eslint-env browser, node, worker */

// ndt7 contains the core ndt7 client functionality. Please, refer
// to the ndt7 spec available at the following URL:
//
// https://github.com/m-lab/ndt-server/blob/master/spec/ndt7-protocol.md
//
// This implementation uses v0.9.0 of the spec.

// Wrap everything in a closure to ensure that local definitions don't
// permanently shadow global definitions.
(function() {
  'use strict';

  // If this is running as a node module then WebSocket, fetch, and Worker
  // may all need to be defined.  In the browser they should already exist.
  if (typeof WebSocket === 'undefined') {
    global.WebSocket = require('isomorphic-ws');
  }
  if (typeof fetch === 'undefined') {
    global.fetch = require('node-fetch');
  }
  if (typeof Worker === 'undefined') {
    global.Worker = require('workerjs');
  }

  /**
   * @name ndt7
   * @namespace ndt7
   */
  const ndt7 = (function() {
    // cb creates a default-empty callback function, allowing library users to
    // only need to specify callback functions for the events they care about.
    //
    // This function is not exported.
    const cb = function(name, callbacks, defaultFn) {
      if (typeof(callbacks) !== 'undefined' && name in callbacks) {
        return callbacks[name];
      } else if (typeof defaultFn !== 'undefined') {
        return defaultFn;
      } else {
        // If no default function is provided, use the empty function.
        return function() {};
      }
    };

    // The default response to an error is to throw an exception.
    const defaultErrCallback = function(err) {
      throw new Error(err);
    };

    const getServerURLs = function(state) {

      const protocol = 'wss://';
      const domain = '.medidor.rnp.br';
      const port = ':4443';
      const pathBase = '/ndt/v7/';
      const statename = new String(state);

      return {
        'download': protocol + statename.toLowerCase() + domain + port + pathBase + 'download',
        'upload': protocol + statename.toLowerCase() + domain + port + pathBase + 'upload'
      };
    }

    const getAverage = function(numbers) {
      let sum = 0;
      for (let i = 0; i < numbers.length; i++) {
        sum += numbers[i];
      }
      return (sum / numbers.length);
    }

    const calculateJitter = function(rtts) {
      let variances = [];
      for (let i = 1; i < rtts.length; i++) {
        variances.push(Math.abs(rtts[i] - rtts[i - 1]));
      }
      return getAverage(variances);
    }

    /*
     * runNDT7Worker is a helper function that runs a webworker. It uses the
     * callback functions `error`, `start`, `measurement`, and `complete`. It
     * returns a c-style return code. 0 is success, non-zero is some kind of
     * failure.
     *
     * @private
     */
    const runNDT7Worker = async function(callbacks, urls, filename, testType) {
      
      let lastClientMeasurement;
      let lastServerMeasurement;
      const rtts = [];

      // This makes the worker. The worker won't actually start until it
      // receives a message.
      const worker = new Worker(filename);

      // When the workerPromise gets resolved it will terminate the worker.
      // Workers are resolved with c-style return codes. 0 for success,
      // non-zero for failure.
      const workerPromise = new Promise((resolve) => {
        worker.resolve = function(returnCode) {
          worker.terminate();
          if (returnCode == 0) {
            lastServerMeasurement.AllRTTs = rtts;
          }
          resolve({
            returnCode: returnCode,
            client: lastClientMeasurement,
            server: lastServerMeasurement
          });
        };
      });

      // If the worker takes 10 seconds, kill it and return an error code.
      // Most clients take longer than 10 seconds to complete the upload and
      // finish sending the buffer's content, sometimes hitting the socket's
      // timeout of 15 seconds. This makes sure uploads terminate on time.
      const workerTimeout = setTimeout(() => worker.resolve(0), 10000);

      // This is how the worker communicates back to the main thread of
      // execution.  The MsgTpe of `ev` determines which callback the message
      // gets forwarded to.
      worker.onmessage = function(ev) {

        if (!ev.data || !ev.data.MsgType || ev.data.MsgType === 'error') {
          
          clearTimeout(workerTimeout);
          worker.resolve(1);
          const message = (!ev.data) ? `${testType} error` : ev.data.Error;
          callbacks.error(message);

        } else if (ev.data.MsgType == 'measurement') {
          // For performance reasons, we parse the JSON outside of the thread
          // doing the downloading or uploading.
          if (ev.data.Source == 'server') {
            lastServerMeasurement = ev.data.ServerData;
            rtts.push(ev.data.ServerData.TCPInfo.RTT);
            /*callbacks.measurement({
              Source: ev.data.Source,
              Data: ev.data.ServerData,
            });*/
          } else {
            lastClientMeasurement = ev.data.ClientData;
            callbacks.measurement({
              Data: ev.data.ClientData
            });
          }
        } else if (ev.data.MsgType == 'closed') {
          clearTimeout(workerTimeout);
          if (ev.data.code == 1006) {
            worker.resolve(1);
            const message = "The connection was closed abnormally, or could not be opened properly";
            callbacks.error(message);
          } else {
            worker.resolve(0);
          }
        }
      };

      // Start the worker.
      worker.postMessage(urls);

      // Await the resolution of the workerPromise.
      return await workerPromise;

      // Liveness guarantee - once the promise is resolved, .terminate() has
      // been called and the webworker will be terminated or in the process of
      // being terminated.
    };

    /**
     * downloadTest runs just the NDT7 download test.
     * @param {Object} config - An associative array of configuration strings
     * @param {Object} userCallbacks
     * @param {Object} urlPromise - A promise that will resolve to urls.
     *
     * @return {number} Zero on success, and non-zero error code on failure.
     *
     * @name ndt7.downloadTest
     * @public
     */
    async function downloadTest(userCallbacks, urls, workerfile) {
      const callbacks = {
        error: cb('error', userCallbacks, defaultErrCallback),
        measurement: cb('downloadMeasurement', userCallbacks)
      };
      return await runNDT7Worker(callbacks, urls, workerfile, 'download')
          .catch((err) => { callbacks.error(err); });
    }

    /**
     * uploadTest runs just the NDT7 upload test.
     * @param {Object} config - An associative array of configuration strings
     * @param {Object} userCallbacks
     * @param {Object} urlPromise - A promise that will resolve to urls.
     *
     * @return {number} Zero on success, and non-zero error code on failure.
     *
     * @name ndt7.uploadTest
     * @public
     */
    async function uploadTest(userCallbacks, urls, workerfile) {
      const callbacks = {
        error: cb('error', userCallbacks, defaultErrCallback),
        measurement: cb('uploadMeasurement', userCallbacks)
      };
      return await runNDT7Worker(callbacks, urls, workerfile, 'upload')
          .catch((err) => { callbacks.error(err); });
    }

    /**
     * test discovers a server to run against and then runs a download test
     * followed by an upload test.
     *
     * @param {Object} config - An associative array of configuration strings
     * @param {Object} userCallbacks
     *
     * @return {number} Zero on success, and non-zero error code on failure.
     *
     * @name ndt7.test
     * @public
     */
    async function test(config, userCallbacks) {

      const startTime = new Date().toLocaleString('pt-BR') + " (UTC-3)";
      const urls = getServerURLs((config && ('state' in config)) ? config.state : 'rj'); // using rj as default

      let downloadWorkerFile = (config && ('libraryPath' in config)) ? config.libraryPath : '';
      downloadWorkerFile += 'ndt7-download-worker.js';
      const downloadResults = await downloadTest(userCallbacks, urls, downloadWorkerFile);

      let results = {};
      results.horario = startTime;
      if (downloadResults.returnCode != 0) {
        return downloadResults.returnCode;
      } else {
        results.banda_download = ((downloadResults.client.NumBytes * 8) / downloadResults.client.ElapsedTime) / 1000000; //from bps to Mbps
        results.retransmissao = (downloadResults.server.TCPInfo.BytesRetrans / downloadResults.server.TCPInfo.BytesSent) * 100; //in %
        results.ip_cliente = downloadResults.server.ConnectionInfo.Client.split(':')[0];
        results.ip_servidor = downloadResults.server.ConnectionInfo.Server.split(':')[0] + " (" + urls['download'].split("/")[2].split(":")[0] + ")";
      }

      let uploadWorkerFile = (config && ('libraryPath' in config)) ? config.libraryPath : '';
      uploadWorkerFile += 'ndt7-upload-worker.js';
      const uploadResults = await uploadTest(userCallbacks, urls, uploadWorkerFile);

      if (uploadResults.returnCode != 0) {
        return downloadResults.returnCode + (uploadResults.returnCode << 4);
      } else {
        results.banda_upload = (uploadResults.server.TCPInfo.BytesReceived * 8) / uploadResults.server.TCPInfo.ElapsedTime;
      }
      const allRTTs = downloadResults.server.AllRTTs.concat(uploadResults.server.AllRTTs);
      results.rtt = getAverage(allRTTs) / 1000; //from us to ms
      results.jitter = calculateJitter(allRTTs) / 1000; //from us to ms

      const final = cb('finalMeasurements', userCallbacks);
      final({
        results: results
      });

      return downloadResults.returnCode + (uploadResults.returnCode << 4);
    }

    return {
      downloadTest: downloadTest,
      uploadTest: uploadTest,
      test: test,
    };
  })();

  // Modules are used by `require`, if this file is included on a web page, then
  // module will be undefined and we use the window.ndt7 piece.
  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = ndt7;
  } else {
    window.ndt7 = ndt7;
  }
})();
