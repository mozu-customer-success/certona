const certona = require('../certona');
const R = require('../ramda');
module.exports = (context, callback) => {
  const model =
    context.response && context.response.body
      ? context.response.body.model
      : null;
  const schemes = context.configuration.schemes;
  certona.screens
    .product(context, {
      schemes,
      itemid: [model.productCode]
    })
    .then(res => {
      res.resonance.schemas = res.resonance.schemas.map(schema => {
        schema.items = R.compose(
          R.join(','),
          R.map(R.pick('ID'))
        )(schema.items);
        return schema;
      });
      model.certona = res.resonance;
    })
    .catch(err => {
      console.warn(err);
    })
    .then(() => {
      context.response.end();
      callback();
    });
};
