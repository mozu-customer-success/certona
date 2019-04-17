module.exports = (context, callback) => {
  context.response.body = '123';
  context.response.end();
  callback();
};
