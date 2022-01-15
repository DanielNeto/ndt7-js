/* eslint-env es6, node */

'use strict';

// People who have this installed as a module (pretty much everyone who is
// reading this) should change this line to:
// const ndt7 = require('@m-lab/ndt7');
const ndt7 = require('../src/ndt7.js');

ndt7.test(
    {
      state: "SP",
      libraryPath: "../src/"
    },
    {
      finalMeasurements: function (data) {
        console.log(data);
      },
      downloadMeasurement: function (data) {
        console.log(data);
      },
      uploadMeasurement: function (data) {
        console.log(data);
      },
      error: function (err) {
        console.log('Error while running the test:', err);
      },
    },
).then((exitcode) => {
  process.exit(exitcode);
});
