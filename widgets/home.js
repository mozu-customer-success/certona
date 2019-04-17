module.exports = {
  config: {
    category: 'catalog',
    id: 'certona_home_recommended',
    displayName: 'Certona Recommended Products',
    displayTemplate: 'certona/home',
    editViewFields: [
      {
        anchor: '100%',
        fieldLabel: 'schema id',
        name: 'schema',
        xtype: 'mz-input-text'
      }
    ],
    icon: '/resources/admin/widgets/power_review_icon.png',
    validPageTypes: ['home']
  }
};
