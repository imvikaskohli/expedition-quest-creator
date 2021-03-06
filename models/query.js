const Moment = require('moment');
const Pg = require('pg');
const Squel = require('squel').useFlavour('postgres');
const Url = require('url');

const Config = require('../config');

Pg.defaults.ssl = true;
const urlparams = Url.parse(Config.get('DATABASE_URL'));
const userauth = urlparams.auth.split(':');
const poolConfig = {
  user: userauth[0],
  password: userauth[1],
  host: urlparams.hostname,
  port: urlparams.port,
  database: urlparams.pathname.split('/')[1],
  ssl: true,
};
const pool = new Pg.Pool(poolConfig);


// runs a Squel query object using a client from the pool
// returns an array of all results converted to JS objects
exports.run = function (query, callback) {

  pool.connect((err, client, done) => {

    if (err) {
      return callback(new Error('error fetching client from pool: ' + err));
    }

    query = query.toParam({ numberedParameters: true });

    console.log('SQL command:', query);

    client.query(query.text, query.values, (err, result) => {

      done(); // release the client back to the pool

      if (err) {
        return callback(err);
      }

      return callback(null, result.rows.map(internals.objectPgToJs));
    });
  });
};


// returns the first result with id = id converted to a JS object
// returns 404 error if no results found
exports.getId = function (table, id, callback) {

  let query = Squel.select()
      .from(table)
      .where('id = ?', id)
      .limit(1);

  exports.run(query, (err, results) => {

    if (err) {
      return callback(err);
    }

    if (results.length === 0) {
      return callback({
        code: 404,
        message: 'Not found',
      });
    }

    return callback(null, results[0]);
  });
};


// deletes row with matching id from table. Returns the id deleted.
exports.deleteId = function (table, id, callback) {

  exports.upsert(table, {id: id, tombstone: Date.now()}, 'id', (err, result) => {
    return callback(err, id);
  });
};


// inserts the object into the table
exports.create = function (table, object, callback) {

  object = internals.objectJsToPg(object);

  let query = Squel.insert()
      .into(table)
      .setFields(object);

  exports.run(query, callback);
};


// inserts object into table, updating it if [id] field already exists
// if checking against a combination of fields, pass string 'field1, field2'
exports.upsert = function (table, object, id, callback) {

  object = internals.objectJsToPg(object);

  let query = Squel.insert()
      .into(table)
      .setFields(object)
      .onConflict(id, object);

  exports.run(query, callback);
};


// updates object(s) in table
exports.update = function (table, filters, updates, callback) {

  filters = internals.objectJsToPg(filters);
  object = internals.objectJsToPg(updates);

  let query = Squel.update()
        .table(table)
        .setFields(object);

  if (filters != null) {
    Object.keys(filters).forEach((key) => {
      query = query.where(key + ' = ' + filters[key]);
    });
  }

  exports.run(query, callback);
};


/* ===== INTERNAL HELPERS ===== */

const internals = {
  dateKeys: ['created', 'lastLogin', 'published', 'tombstone', 'updated'], // columns that're always dates
  regexKeyJsToPg: /([A-Z])/g,
  regexKeyPgToJs: /_([a-z])/g,
  replacerKeyJsToPg: (match, p1) => '_' + p1.toLowerCase(),
  replacerKeyPgToJs: (match, p1) => p1.toUpperCase(),
};


internals.dateJsToPg = function (date) {

  return Moment(date).utc().format('YYYY-MM-DD HH:mm:ss');
};


internals.stringJsToPg = function (str) {
  return str;
}

// switches prop names from lower camel case (javascript) to lower snake case (postgres)
// ex: 'thisIsAPropName' -> 'this_is_a_prop_name'
internals.keyJsToPg = function (str) {

  return str.replace(internals.regexKeyJsToPg, internals.replacerKeyJsToPg);
};


// want to use this on an array of objects? do const newArr = arr.map(internals.objectJsToPg);
internals.objectJsToPg = function (object) {

  const result = {};

  Object.keys(object).forEach((key) => {

    let val = object[key];
    if (val instanceof Date || internals.dateKeys.indexOf(key) !== -1) {
      if (val != null) {
        val = internals.dateJsToPg(val);
      }
    }
    else if (typeof val === 'string') {
      val = internals.stringJsToPg(val);
    }
    result[internals.keyJsToPg(key)] = val;
  });

  return result;
};


// switches prop names from lower snake case (postgres) to lower camel case (javascript)
// ex: 'this_is_a_prop_name' -> 'thisIsAPropName'
internals.keyPgToJs = function (str) {

  return str.replace(internals.regexKeyPgToJs, internals.replacerKeyPgToJs);
};


internals.stringPgToJs = function (str) {
  return str.replace(/''/g, "\'");
};


// want to use this on an array of objects? do const newArr = arr.map(internals.objectPgToJs);
internals.objectPgToJs = function (object) {

  const result = {};

  Object.keys(object).forEach((key) => {

    let val = object[key];
    if (typeof val === 'string') {
      val = internals.stringPgToJs(val);
    }
    result[internals.keyPgToJs(key)] = val;
  });

  return result;
};

exports.internals = internals; // expose for testing; obviously not meant to be used by other code
