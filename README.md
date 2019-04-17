# certona

## goals

- capture events on page requests / add to cart events etc.
- add recommendation data to the page model
- provide widgets that render the recommendations on page load
- widgets should be generic like a product list and have an option to target different schemes

## approach

- home page is requested
- make a call to the certona engine with the user tracking information
- indicate in the arc.js config which schemas should be included in the page
- drop a product slider widget on the home page with a config setting indicate which
  schema it's tied to
- use the include_products tag to build the html server side
- add interactivity after page load if necessary

### version 0.1.0
