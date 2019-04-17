const R = require('./ramda');

const type = [
  'Object',
  'Null',
  'Undefined',
  'Array',
  'Number',
  'String',
  'Function',
  'Boolean',
  'Promise'
].reduce(
  (a, t) => {
    a[`is${t}`] = v => a(v) === t;
    return a;
  },
  val => {
    return val === null
      ? 'Null'
      : val === undefined
      ? 'Undefined'
      : Object.prototype.toString.call(val).slice(8, -1);
  }
);

const lens = R.curry((path, obj) => {
  path = type.isString(path) ? path.split('.') : path;
  if (!obj || !type.isObject(obj)) return obj;
  if (!path.length) return obj;
  let key = head(path);
  if (!(key in obj)) return null;
  return lens(tail(path), obj[head(path)]);
});

const clientFactory = R.curry((context, client) => {
  let c = client(context);
  let claims = c.context[constants.headers.USERCLAIMS];
  c.removeClaims = () => {
    c.context[constants.headers.USERCLAIMS] = null;
  };
  c.restoreClaims = () => {
    c.context[constants.headers.USERCLAIMS] = claims;
  };
});

const mixin = (proto, ...sources) => {
  return Object.assign(Object.create(proto), ...sources);
};

const print = (...args) => {
  try {
    args.forEach(obj => {
      console.log('object' === typeof obj ? JSON.stringify(obj, null, 2) : obj);
    });
  } catch (e) {
    console.log(e);
  }
  return args[0];
};

const clientFactory = R.curryN(2, (context, client, removeClaims) => {
  let c = client(context);
  let claims = c.context[constants.headers.USERCLAIMS];
  c.removeClaims = () => {
    c.context[constants.headers.USERCLAIMS] = null;
  };
  c.restoreClaims = () => {
    c.context[constants.headers.USERCLAIMS] = claims;
  };
  if (removeClaims) c.removeClaims();
});

const errorDefinitions = {
  400: 'bad request',
  401: 'not authorized to use the requested resource',
  403: 'forbidden',
  404: 'not found',
  405: 'requested method not supported',
  500: 'unexpected error'
};

const throwError = R.curryN(2, (code = '500', message, ...additionalInfo) =>
  mixin(
    { isError: true },
    {
      code,
      message: message || errorDefinitions[code] || errorDefinitions['500'],
      additionalInfo
    }
  )
);

const catchHandler = error => {
  if (!error || !error.isError) error = throwError(500, error);
  print(error);
  return error;
};

const passError = R.curry((context, boundCb, value) => {
  if (context && context.response) {
    context.response.body = value;
    context.response.end();
  }
  value && value.isError ? boundCb(value) : boundCb();
});

const getFromCache = function getFromCache(
  context,
  key,
  cacheOpts,
  ttl,
  isValuePrimitive,
  onNullAddToCacheDelegate
) {
  let cachedTTL = ttl || 10;

  let cacheDefaults = {
    type: 'distributed',
    scope: 'tenant',
    level: 'shared'
  };
  cacheOpts = Object.assign(cacheDefaults, cacheOpts ? cacheOpts : {});

  return new Promise(function(resolve, reject) {
    try {
      cache = context.cache.getOrCreate(cacheOpts);
      console.error(key);
      cache.get(key, (err2, cachedValue) => {
        console.log(cachedValue);
        if (cachedValue != null) {
          if (Buffer.isBuffer(cachedValue))
            cachedValue = JSON.parse(cachedValue);

          return resolve(
            isValuePrimitive ? cachedValue : JSON.parse(cachedValue)
          );
        }
        if (err2 || (cachedValue == null && !onNullAddToCacheDelegate))
          return reject(
            err2 ? err2 : 'not found in cache / no delegate provided'
          );
        if (onNullAddToCacheDelegate)
          onNullAddToCacheDelegate()
            .then(result => {
              console.log('result', result);
              cache.set(
                key,
                typeof result === 'object' ? JSON.stringify(result) : result,
                cachedTTL,
                (err, result) => {
                  console.log('set cache key callback', err);
                }
              );
              return resolve(result);
            })
            .catch(reject);
      });
    } catch (error) {
      return reject(error);
    }
  });
};

module.exports = {
  type,
  clientFactory,
  mixin,
  getFromCache,
  throwError,
  catchHandler,
  passError,
  print
};
