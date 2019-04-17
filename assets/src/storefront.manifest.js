module.exports = {
  'http.storefront.pages.cmspage.request.after': {
    actionName: 'http.storefront.pages.cmspage.request.after',
    customFunction: require('./domains/storefront/http.storefront.pages.productDetails.request.after')
  },
  'http.storefront.pages.productDetails.request.after': {
    actionName: 'http.storefront.pages.productDetails.request.after',
    customFunction: require('./domains/storefront/http.storefront.pages.productDetails.request.after')
  }
};
