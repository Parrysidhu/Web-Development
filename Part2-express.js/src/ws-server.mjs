import assert from 'assert';
//import cors from 'cors';
import express from 'express';
import bodyParser from 'body-parser';
import querystring from 'querystring';

import ModelError from './model-error.mjs';

//not all codes necessary
const OK = 200;
const CREATED = 201;
const NO_CONTENT = 204;
const BAD_REQUEST = 400;
const NOT_FOUND = 404;
const CONFLICT = 409;
const SERVER_ERROR = 500;

const BASE = 'api';

export default function serve(port, meta, model) {
  const app = express();
  app.locals.port = port;
  app.locals.meta = meta;
  app.locals.model = model;
  setupRoutes(app);
  app.listen(port, function() {
    console.log(`listening on port ${port}`);
  });
}

function setupRoutes(app) {
  //app.use(cors());

  //pseudo-handlers used to set up defaults for req
  app.use(bodyParser.json());      //always parse request bodies as JSON
  app.use(reqSelfUrl, reqBaseUrl); //set useful properties in req

  //application routes
  app.get(`/${BASE}`, doBase(app));
  //@TODO: add other application routes
  app.get(`/${BASE}/books/:isbn`, doGet(app));
  app.post(`/${BASE}/carts`, doPost(app));
  app.patch(`/${BASE}/carts/:id`, doUpdate(app));
  app.get(`/${BASE}/carts/:id`, doGetCart(app));
  app.get(`/${BASE}/books`, doGetBooksQ(app));


  //must be last
  app.use(do404(app));
  app.use(doErrors(app));
}

/****************************** Handlers *******************************/

/** Sets selfUrl property on req to complete URL of req,
 *  including query parameters.
 */
function reqSelfUrl(req, res, next) {
  const port = req.app.locals.port;
  req.selfUrl = `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
  next();  //absolutely essential
}

/** Sets baseUrl property on req to complete URL of BASE. */
function reqBaseUrl(req, res, next) {
  const port = req.app.locals.port;
  req.baseUrl = `${req.protocol}://${req.hostname}:${port}/${BASE}`;
  next(); //absolutely essential
}

function doBase(app) {
  return function(req, res) { 
    try {
      const links = [
	{ rel: 'self', name: 'self', href: req.selfUrl, },
	{ rel: 'collection', name: 'books', href: req.selfUrl + '/books'},
	{ rel: 'collection', name: 'carts', href: req.selfUrl + '/carts'}
	//@TODO add links for book and cart collections
      ];
      res.json({ links });
    }
    catch (err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

//@TODO: Add handlers for other application routes

function doPost(app) {
  return async function(req, res) {
    try {
      const obj = req.body;
      const results = await app.locals.model.newCart(obj);
      res.append('Location', requestUrl(req) + '/' + results);
      res.sendStatus(CREATED);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

function doUpdate(app) {
  return async function(req, res) {
    try {
      const patch = Object.assign({}, req.body);
      patch.cartId = req.params.id;
      patch.sku = req.body.sku;
      patch.nUnits = req.body.nUnits;
      const results = await app.locals.model.cartItem(patch);
      res.sendStatus(OK);
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}


function doGet(app) {
  return async function(req, res) {
    try {
      const patch = Object.assign({}, req.body);
      patch.isbn = req.params.isbn;
      const results = await app.locals.model.findBooks(patch);
      if (results.length !== 1) {
		throw [ new ModelError("BAD_ID", 'no book for isbn : ' + req.params.isbn, 'isbn') ];
      }
      else {
		let out = {};
		out.result = results;
		out.links = [
			{ rel: 'self', name: 'self', href: req.selfUrl }
		];
		res.json(out);
      }
    }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}





function doGetCart(app) {
  return async function(req, res) {
    try {
      const patch = Object.assign({}, req.body);
      //console.log(req);
      patch.cartId = req.params.id;
      const results = await app.locals.model.getCart(patch);
      results.links = [
			{ rel: 'self', name: 'self', href: req.selfUrl }
		];
		results.result = [];
		for(const [key, value] of Object.entries(results)) {
			if(key.match(/[0-9-]/) !== null) {
				const url = req.baseUrl + '/books/' + key;
				results.result.push(
					{
						 "links" : [ { rel: 'item', name: 'book', href: url } ],
						 "nUnits" : value,
						 "sku" : key
					  }
				);
				
				delete results[key];
			}
		}
		
		//console.log(results);
      	res.json(results);
      }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}

function doGetBooksQ(app) {
  return async function(req, res) {
    try {
      const patch = Object.assign({}, req.body);
      patch.authorsTitleSearch = req.query.authorsTitleSearch;
      patch._index = req.query._index ? req.query._index : 0;
      patch._count = req.query._count ? req.query._count : 5;
      const results = await app.locals.model.findBooks(patch);

      const check = Object.assign({}, patch);
      check._count = Number(check._count) + 1;
      const resultsCheck = await app.locals.model.findBooks(check);
      let out = {};
      out.result = results;
      out.links = [
			{ rel: 'self', name: 'self', href: req.selfUrl }
		];

		if(resultsCheck.length > patch._count) {
			let next = '';
			if(req.query._count !== undefined) {
				next = req.baseUrl + '/books?authorsTitleSearch=' + patch.authorsTitleSearch + '&_index=' + patch._count + '&_count=' + patch._count;
			} else {
				next = req.baseUrl + '/books?authorsTitleSearch=' + patch.authorsTitleSearch + '&_index=' + patch._count;
			}
			
			out.links.push(
				{ rel: 'next', name: 'next', href: next }
			);
		}

		if(req.query._index > 0) {
			let prev = '';
			if(req.query._count !== undefined) {
				prev = req.baseUrl + '/books?authorsTitleSearch=' + patch.authorsTitleSearch + '&_index=' + Number(patch._index) % 5 + '&_count=' + patch._count;
			} else {
				prev = req.baseUrl + '/books?authorsTitleSearch=' + patch.authorsTitleSearch + '&_index=' + Number(patch._index) % 5;
			}
			out.links.push(
				{ rel: 'prev', name: 'prev', href: prev }
			);
		}

		for(const e of out.result) {
			const url = req.baseUrl + '/books/' + e.isbn;
			e.links = [ { rel: 'details', name: 'book', href: url } ];
		}
      	res.json(out);
      }
    catch(err) {
      const mapped = mapError(err);
      res.status(mapped.status).json(mapped);
    }
  };
}



/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    const result = {
      status: NOT_FOUND,
      errors: [	{ code: 'NOT_FOUND', message, }, ],
    };
    res.type('text').
	status(404).
	json(result);
  };
}


/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    const result = {
      status: SERVER_ERROR,
      errors: [ { code: 'SERVER_ERROR', message: err.message } ],
    };
    res.status(SERVER_ERROR).json(result);
    console.error(err);
  };
}


/*************************** Mapping Errors ****************************/

const ERROR_MAP = {
  BAD_ID: NOT_FOUND,
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code and an errors property containing list of error objects
 *  with code, message and name properties.
 */
function mapError(err) {
  const isDomainError =
    (err instanceof Array && err.length > 0 && err[0] instanceof ModelError);
  const status =
    isDomainError ? (ERROR_MAP[err[0].code] || BAD_REQUEST) : SERVER_ERROR;
  const errors =
	isDomainError
	? err.map(e => ({ code: e.code, message: e.message, name: e.name }))
        : [ { code: 'SERVER_ERROR', message: err.toString(), } ];
  if (!isDomainError) console.error(err);
  return { status, errors };
} 

/****************************** Utilities ******************************/

/** Return original URL for req */
function requestUrl(req) {
  const port = req.app.locals.port;
  return `${req.protocol}://${req.hostname}:${port}${req.originalUrl}`;
}

