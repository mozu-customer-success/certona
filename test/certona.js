import assert from 'assert';
import context from './context';
import certona from '../assets/src/certona';

Promise.all([
  certona.screens.home(context, {}).then(
    res => {
      if (!res.resonance) {
        return {
          home: res
        };
      }
    },
    err => ({ home: err })
  )
]).then(errors => {
  console.log(errors.filter(Boolean));
});
