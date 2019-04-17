const axios = require('axios');
const R = require('/ramda');
const CustomerAttribute = require('mozu-node-sdk/clients/commerce/customer/accounts/customerAttribute');
const AttributeDefinition = require('mozu-node-sdk/clients/commerce/customer/attributedefinition/attribute');
const util = require('/util');
const constants = require('/constant');

const defaultActionOptions = {
  requiredParams: '',
  requiredContext: '',
  allowExternal: true
};

const actionWrapper = (
  options = {},
  action = () => Promise.reject(util.throwError(404, undefined))
) => {
  for (let key of Object.keys(defaultActionOptions)) {
    if (typeof options[key] === 'undefined') {
      options[key] = defaultActionOptions[key];
    }
  }

  //certona specific
  if (options.returnsRecommendations) {
    config.body.output = 'json';
  }
  //

  return function(context, config) {
    if (!context.baseUrl) {
      console.warn('missing baseUrl');
      return Promise.reject(util.throwError(500, undefined));
    }
    if (!options.allowExternal && config.isExternal) {
      return Promise.reject(util.throwError(404, undefined));
    }
    let missingParams = R.difference(
      Object.keys(options.requiredParams),
      Object.keys(config.body)
    );
    if (missingParams.length) {
      return Promise.reject(
        util.throwError(400, 'missing required parameters', missingParams)
      );
    }
    let invalidTypeParams = Object.entries(config.body).filter(
      ([key, type]) => {
        return util.type(type) !== options.requiredParams[key];
      }
    );
    if (Object.keys(invalidTypeParams).length) {
      return Promise.reject(
        util.throwError(
          400,
          'invalid parameter type',
          R.fromPairs(invalidTypeParams)
        )
      );
    }
    let missingContext = R.difference(
      options.requiredContext.split(' '),
      Object.keys(context)
    );
    if (missingContext.length) {
      console.warn('missing requiredContext', missingContext);
      return Promise.reject(util.throwError(500, undefined));
    }
    let promise = action.call(context, R.clone(config));
    if (config.isExternal) {
      promise.then(R.omit(constants.protectedData.split(' ')));
    }
    return promise;
  };
};

const kibo = {
  getAttributeDefinition: function(
    templateArgs = { accountId: '', attributeFQN: '' },
    data = {}
  ) {
    return util.getFromCache(
      this,
      fqn,
      {
        scope: 'tenant'
      },
      60,
      false,
      () => {
        util.clientFactory(AttributeDefinition, this, true)(templateArgs, data);
      }
    );
  },
  getAccountAttribute: function(
    templateArgs = { accountId: '', attributeFQN: '' },
    data = {}
  ) {
    return util
      .clientFactory(CustomerAttribute, context, true)
      .getAccountAttribute(templateArgs, data)
      .then(util.lens('values'));
  },
  addOrUpdateAccountAttribute: function(
    templateArgs = { attributeFQN: '', accountId: '' },
    data = { values: [''] }
  ) {
    let { attributeFQN, accountId } = templateArgs;
    return kibo
      .getAttributeDefinition({ attributeFQN })
      .then(attributeDefinition => {
        return customerAttribute
          .updateAccountAttribute(templateArgs, {
            body: Object.assign(data, {
              fullyQualifiedName: attributeFQN,
              attributeDefinitionId: attributeDefinition.id
            })
          })
          .catch(err => {
            return customerAttribute.addAccountAttribute(
              {
                accountId
              },
              {
                body: Object.assign(data, {
                  fullyQualifiedName: attributeFQN,
                  attributeDefinitionId: attributeDefinition.id
                })
              }
            );
          });
      });
  }
};

const encodeItems = (items = [{}]) => {
  const del = constants.listDelimiter;
  return items.reduce(
    (acc, item, dex) => {
      acc.itemid += (dex ? del : '') + item.productCode + del;
      acc.qty += (dex ? del : '') + item.quantity + del;
      acc.itemid += (dex ? del : '') + item.productCode + del;
      return acc;
    },
    { itemid: '', qty: '', price: '' }
  );
};

const certona = {
  //assuming tracking id is same as customerid for now
  getTrackingId: actionWrapper(
    {
      allowExternal: false,
      requiredParams: {
        accountId: ''
      },
      requiredContext: 'trackingIdFqn'
    },
    function(config) {
      return kibo
        .getAccountAttribute({
          accountId: config.body.accountId,
          attributeFQN: context.trackingIdFqn
        })
        .then(values => ({ trackingid: values[0], customerid: values[0] }));
    }
  ),
  setTrackingId: actionWrapper(
    {
      allowExternal: false,
      requiredParams: {
        accountId: ''
      },
      requiredContext: 'trackingIdFqn'
    },
    function(config) {
      return kibo.addOrUpdateAccountAttribute(
        {
          attributeFQN: context.trackingIdFqn,
          accountId: config.body.accountId
        },
        {
          values: [config.body.value]
        }
      );
    }
  ),
  request: actionWrapper(
    {
      allowExternal: false,
      requiredParams: {
        appid: '',
        trackingid: '',
        url: '',
        customerid: ''
      },
      requiredContext: 'baseUrl'
    },
    function(config) {
      return axios({
        baseUrl: this.baseUrl,
        method: 'post',
        params: Object.assign(config.body)
      });
    }
  ),
  //screens should receive event details and return recommendations if appropriate
  screens: R.map(
    screen => {
      return actionWrapper(
        {
          allowExternal: false,
          requiredParams: {
            accountId: ''
          },
          requiredContext: 'appid'
        },
        function(config) {
          return certona.getTrackingId
            .call(this, config)
            .then(tracking => {
              config.body = Object.assign(config.body, tracking);
              return config;
            })
            .then(screen);
        }
      );
    },
    {
      home: actionWrapper(
        {
          allowExternal: false,
          returnsRecommendations: false
        },
        function(config) {
          config.body.url = 'HOME';
          return certona.request(config);
        }
      ),
      search: actionWrapper(
        {
          allowExternal: false,
          returnsRecommendations: false
        },
        function(config) {
          config.body.url = 'SEARCH';
          return certona.request(config);
        }
      ),
      purchase: actionWrapper(
        {
          allowExternal: false,
          requiredParams: {
            items: [],
            total: 0,
            transactionid: ''
          },
          returnsRecommendations: false
        },
        function(config) {
          config.body.url = 'PURCHASE';
          config.body.event = 'purchase';
          config.body = Object.assign(
            config.body,
            encodeItems(config.body.items)
          );
          delete config.body.items;
          return certona.request(config);
        }
      ),
      product: actionWrapper(
        {
          allowExternal: false,
          requiredParams: {
            scheme: [],
            itemid: []
          },
          returnsRecommendations: true
        },
        function(config) {
          config.body.scheme = config.body.scheme.join(constants.listDelimiter);
          config.body.itemid = config.body.itemid.join(constants.listDelimiter);
          config.body.url = 'PRODUCT';
          config.body.event = 'product';
          return certona.request(config);
        }
      )
    }
  )
};

module.exports = certona;
