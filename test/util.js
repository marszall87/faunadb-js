'use strict';

var chai = require('chai');
var Client = require('../src/Client');
var Expr = require('../src/Expr');
var values = require('../src/values');
var query = require('../src/query');
var objectAssign = require('object-assign');
var util = require('../src/_util');

var assert = chai.assert;
var Database = query.Database;
var Value = values.Value;

var env = process.env;

var testConfig;
try {
  testConfig = require('../testConfig.json');
} catch (err) {
  console.log('testConfig.json not found, defaulting to environment variables');
  if (typeof env.FAUNA_DOMAIN === 'undefined' ||
      typeof env.FAUNA_SCHEME === 'undefined' ||
      typeof env.FAUNA_PORT === 'undefined' ||
      typeof env.FAUNA_ROOT_KEY === 'undefined') {
    console.log('Environment variables not defined. Please create a config file or set env vars.');
    process.exit();
  }

  testConfig = {
    domain: env.FAUNA_DOMAIN,
    scheme: env.FAUNA_SCHEME,
    port: env.FAUNA_PORT,
    auth: env.FAUNA_ROOT_KEY
  };
}

function takeObjectKeys(object) {
  var out = {};
  for (var i = 0; i < arguments.length; ++i) {
    var key = arguments[i];
    out[key] = object[key];
  }
  return out;
}

function getClient(opts) {
  var cfg = util.removeUndefinedValues(takeObjectKeys(testConfig, 'domain', 'scheme', 'port'));
  return new Client(objectAssign({ secret: clientSecret }, cfg, opts));
}

function assertRejected(promise, errorType) {
  var succeeded = false;

  return promise.then(function() {
    succeeded = true;
    assert(!succeeded, 'Expected promise to fail.');
  }, function(error) {
    if (!(error instanceof errorType)) {
      throw error;
    }
  });
}

// Set in before hook, so won't be null during tests
var _client = null;
var clientSecret = null;

function client() {
  return _client;
}

function randomString(prefix) {
  var rand = (Math.random() * 0xFFFFFF << 0).toString(16);
  return (prefix || '') + rand;
}

function unwrapExpr(obj) {
  if (obj instanceof Value) {
    return obj;
  } else if (obj instanceof Expr) {
    return unwrapExprValues(obj.raw);
  } else {
    return obj;
  }
}

function unwrapExprValues(obj) {
  if (Array.isArray(obj)) {
    return obj.map(function(elem) {
      return unwrapExpr(elem);
    });
  } else if (typeof obj === 'object') {
    var rv = {};

    Object.keys(obj).forEach(function (key) {
      rv[key] = unwrapExpr(obj[key]);
    });

    return rv;
  } else {
    return obj;
  }
}

var rootClient = getClient({ secret: testConfig.auth });
var dbName = randomString('faunadb-js-test-');
var dbRef = query.Database(dbName);

// global before/after for every test

before(function () {
  return rootClient.query(query.CreateDatabase({ name: dbName })).then(function() {
    return rootClient.query(query.CreateKey({ database: Database(dbName), role: 'server' }));
  }).then(function(key) {
    clientSecret = key.secret;
    _client = getClient();
  }).catch(function(exception) {
    console.log('failed: ' + exception);
  });
});

after(function () {
  return rootClient.query(query.Delete(dbRef));
});

module.exports = {
  getClient: getClient,
  assertRejected: assertRejected,
  client: client,
  clientSecret: clientSecret,
  rootClient: rootClient,
  dbRef: dbRef,
  unwrapExpr: unwrapExpr,
  randomString: randomString
};
